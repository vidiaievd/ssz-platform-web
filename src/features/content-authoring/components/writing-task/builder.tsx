'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Undo2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import {
  analyse,
  issues,
  rubricMax,
  stepState,
  usablePoints,
  type Issue,
  type IssueStep,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import type { AudioDraft, AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepFrame } from './step-frame';
import { StepFlow } from './step-flow';
import { StepMarking } from './step-marking';
import { StepTask } from './step-task';
import {
  sameDocument,
  useWritingTaskAutosave,
  type SavedDocument,
} from './use-writing-task-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * Where this builder keeps the audio layer — and it keeps less of it than the others.
 *
 * A clip here is a stimulus, not a question: "listen to this, then write about it". There
 * are no items to time, no gate to open and no listen to ration, so the plan gives this
 * type the switch and the source and nothing else (plan 56 phase 6). The three parts that
 * are never drawn still need a step, because a finding has to land somewhere — they all
 * point at step 1, where the clip is.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 1, transcript: 1 };
const LAST_STEP = 4;

export interface WritingTaskBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: WritingTask;
  /** The listening layer, carried beside the document (plan 56 phase 6). */
  initialAudio: AudioDraft;
  onDocumentChange?: (exercise: WritingTask) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The writing-task builder: four steps, one document, a rail that says where the problems
 * are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring is not
 * linear: the must-cover points written in step 1 are what the rubric's first criterion
 * marks in step 3, and the word range set in step 2 is what makes the step-3 tester say
 * a text is too short. The teacher will go back.
 *
 * Two things this builder does not have, both deliberate. There is no separate
 * instruction field: the one line the student reads lives in the document (step 1) and is
 * mirrored onto the platform's instruction row when it saves. And there is no marking
 * queue inside it — plan 50 §3.3 keeps the one queue the platform already has, and step 4
 * links into it rather than growing a second one.
 */
export function WritingTaskBuilder({
  exerciseId,
  containerId,
  initialExercise,
  initialAudio,
  onDocumentChange,
  onSavedRemote,
}: WritingTaskBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [audio, setAudio] = useState(initialAudio);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  /**
   * The document as this page found it.
   *
   * A save the author never presses is the right default — the four builders before this
   * one work the same way, and an exercise waits in its draft until the module is
   * published, so nothing typed here reaches a student either way. What that costs is the
   * oldest undo there is: reloading the page no longer brings back what was there before,
   * because autosave has already written it. This is what gives that back — state that is
   * set once and never again, so it stays put while the document moves under it.
   */
  const [opened] = useState(initialExercise);

  const autosave = useWritingTaskAutosave({
    audio,
    exerciseId,
    containerId,
    exercise,
    onSaved: (updatedAt, saved) => {
      setExercise((current) => ({ ...current, updatedAt }));
      onSavedRemote?.(updatedAt, saved);
    },
  });

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  const problems = useMemo(() => issues(exercise), [exercise]);

  /**
   * The layer's findings, in the same rail and the same gate as the type's own.
   *
   * No items are passed: this template has none to time, which is also why `items.ts`
   * leaves it out of its table.
   */
  const audioProblems = useAudioProblems(audio, [], AUDIO_STEPS);

  const changedSinceOpen = !sameDocument(exercise, opened);

  const revert = () => {
    // The token of the row as it stands, on the document as it was: the write has to land
    // on the version autosave last wrote, or it would be refused as somebody else's.
    setExercise({ ...opened, updatedAt: exercise.updatedAt });
    setRevertOpen(false);
  };

  useBuilderSaveNotices({
    status: autosave.status,
    rejection: autosave.rejection,
    failures: autosave.failures,
    onRetry: autosave.retry,
  });

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        {/*
          The bar carries the rail and the save hint — `Saving… / Saved`, and nothing
          about a save that did not work: those are raised as a toast or a dialog, where
          there is room to say what happened (`builder-save-notices.tsx`).

          It also carries no button of its own. It used to
          end in `Review & finish`, which sat two inches from the shell's `Review &
          publish` and read as the same offer twice — the author cannot see from there
          that one opens a checklist and the other publishes the module. The gate is the
          way out of the last step (`BuilderStepNav`), which is where the author arrives
          having answered the four steps.

          `min-w-0` on both the row and the rail's own wrapper: without it the rail keeps
          its full width, the row overflows the bar's slot and the buttons beside it are
          painted over. It shows up the moment the save hint grows — a refusal is the
          longest thing this row ever holds.
        */}
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <WritingTaskSteps
            current={step}
            exercise={exercise}
            audioProblems={audioProblems}
            onSelect={setStep}
          />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <BuilderSaveHint status={autosave.status} savedAt={autosave.savedAt} />
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && (
          <StepTask
            exercise={exercise}
            onChange={setExercise}
            audio={audio}
            onAudioChange={setAudio}
          />
        )}
        {step === 2 && <StepFrame exercise={exercise} onChange={setExercise} />}
        {step === 3 && <StepMarking exercise={exercise} onChange={setExercise} />}
        {step === 4 && (
          <StepFlow exercise={exercise} containerId={containerId} onChange={setExercise} />
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => t(`writingTask.shell.step${n}` as 'writingTask.shell.step1')}
          onSelect={(next) => setStep(next as IssueStep)}
          onDone={() => setGateOpen(true)}
        />
      </div>

      <GateDialog
        open={gateOpen}
        exercise={exercise}
        problems={problems}
        audioProblems={audioProblems}
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target as IssueStep);
          setGateOpen(false);
        }}
      />

      {/*
        The one save state that is a question rather than a report. Reading the other
        version means leaving this one, so it is a reload and not a silent swap: the
        author's unsaved work is on screen, and nothing may take it away without saying so.
      */}
      {/*
        Rare, and it throws away everything typed since the page opened — so it is a plain
        link rather than a button competing with the way forward, and it asks first.
        Hidden while there is nothing to undo: an offer to revert a document nobody has
        touched is an offer to do nothing.
      */}
      {changedSinceOpen && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setRevertOpen(true)}
          >
            <Undo2 className="size-3.5" aria-hidden />
            {t('builder.revert')}
          </Button>
        </div>
      )}

      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.revertTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('builder.revertBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('builder.revertCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={revert}>{t('builder.revertConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BuilderConflictDialog
        open={autosave.status === 'conflict'}
        onOverwrite={autosave.overwrite}
        onDiscard={() => window.location.reload()}
      />
    </div>
  );
}

/**
 * Where the problems are, per step, in the rail every builder shares.
 *
 * The state of a step is the kernel's answer, not this component's: `stepState` is what
 * the server's pre-flight reads too, and a rail that worked it out for itself would be a
 * second opinion about the same document.
 */
function WritingTaskSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: WritingTask;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = t(`writingTask.shell.step${step}` as 'writingTask.shell.step1');
    const sub = t(`writingTask.shell.stepSub${step}` as 'writingTask.shell.stepSub1');

    if (state.s === 'err') {
      return {
        n: step,
        label,
        sub,
        status: 'blockers',
        blockers: state.errs,
        statusLabel: t('builder.blockerCount', { count: state.errs }),
      };
    }
    if (state.s === 'warn') {
      return { n: step, label, sub, status: 'warn', statusLabel: t('builder.warningCount') };
    }
    if (state.s === 'empty') {
      return { n: step, label, sub, status: 'empty', statusLabel: t('builder.stepEmpty') };
    }
    return { n: step, label, sub, status: 'ok', statusLabel: t('builder.stepOk') };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={t('writingTask.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * `info` issues are left out: the gate answers "may this reach a student", and an
 * observation that changes no answer would sit in the list looking like something to fix.
 * They belong inline on the step that owns them.
 */
function GateDialog({
  open,
  exercise,
  problems,
  audioProblems,
  onOpenChange,
  onGoToStep,
}: {
  open: boolean;
  exercise: WritingTask;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const describeIssue = useIssueCopy(exercise);
  const audioRows = useAudioGateRows(audioProblems);

  const rows: GateRow[] = [
    ...audioRows,
    ...problems
      .filter((issue) => issue.level === 'blocker')
      .map((issue, index) => ({
        key: `blocker-${issue.code}-${index}`,
        level: 'blocker' as const,
        text: describeIssue(issue),
        step: issue.step,
      })),
    ...problems
      .filter((issue) => issue.level === 'warning')
      .map((issue, index) => ({
        key: `warning-${issue.code}-${index}`,
        level: 'warning' as const,
        text: describeIssue(issue),
        step: issue.step,
      })),
  ];

  return (
    <BuilderGateDialog
      open={open}
      rows={rows}
      passes={usePasses(exercise)}
      onOpenChange={onOpenChange}
      onGoToStep={onGoToStep}
    />
  );
}

/**
 * What this exercise is about to do to a student, in the author's own numbers.
 *
 * Everything here is restated from settings the author already chose, which is the point:
 * they chose them one step at a time, and this is the only place they are read together.
 * The line that is not a setting — that a person reads every answer — is the one worth
 * stating most, because it is the only promise this template makes that no switch on any
 * step can take back.
 *
 * The example-answer line reports coverage rather than presence. An example that misses a
 * point is the cheapest available evidence that the keywords for that point do not match
 * how anyone writes it, and the gate is where an author is still willing to look.
 */
function usePasses(exercise: WritingTask): string[] {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const points = usablePoints(exercise);
  const analysis = analyse(exercise, exercise.model);
  const covered = analysis.cover.filter((point) => point.hit).length;

  return [
    t('writingTask.gate.points', { points: points.length, criteria: exercise.rubric.length }),
    t('writingTask.gate.pass', { passScore: s.passScore, max: rubricMax(exercise) }),
    exercise.model.trim() === ''
      ? t('writingTask.gate.modelNone')
      : covered === points.length
        ? t('writingTask.gate.modelCovers', { total: points.length })
        : t('writingTask.gate.modelMisses', { covered, total: points.length }),
    s.maxWords > 0
      ? t('writingTask.gate.range', { min: s.minWords, max: s.maxWords })
      : t('writingTask.gate.rangeOpen', { min: s.minWords }),
    s.timer > 0 ? t('writingTask.gate.timer', { timer: s.timer }) : t('writingTask.gate.timerOff'),
    t('writingTask.gate.teacher'),
    s.aiStage
      ? t('writingTask.gate.ai', {
          audience: t(
            `writingTask.step4.audience.${s.aiVisibility}` as 'writingTask.step4.audience.teacher',
          ),
        })
      : t('writingTask.gate.aiOff'),
    s.revision === 'once'
      ? t('writingTask.gate.revisionOnce')
      : t('writingTask.gate.revisionAllowed'),
  ];
}
