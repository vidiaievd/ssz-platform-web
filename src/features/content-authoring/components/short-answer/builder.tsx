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
  coverage,
  gradeableQuestions,
  issues,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/short-answer';

import type { AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepQuestions } from './step-questions';
import { StepKey } from './step-key';
import { StepVerdict } from './step-verdict';
import { StepReview } from './step-review';
import type { ShortAnswerDocument } from './edits';
import {
  sameDocument,
  useShortAnswerAutosave,
  type SavedDocument,
} from './use-short-answer-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * Where this builder keeps each part of the audio layer.
 *
 * The clip and the timecodes both sit on step 1, because that is where the questions are
 * and a timecode belongs to a question. The rules and the transcript are both step 3:
 * that step is what the student is given the moment they hand an answer in, and when the
 * transcript is shown is exactly that question asked about the clip. Step 4 is the
 * pipeline — AI and a teacher — and nothing about hearing is decided there.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 3, transcript: 3 };
const LAST_STEP = 4;

export interface ShortAnswerBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: ShortAnswerDocument;
  onDocumentChange?: (exercise: ShortAnswerDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The short-answer builder: four steps, one document, a rail that says where the problems
 * are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring this type is
 * emphatically not linear: the model answer written in step 1 is what step 2's key is
 * validated against, and an author who finds in step 2 that their own answer does not pass
 * their own key will go back and reword one or the other. That loop is the builder.
 *
 * Two things it does not have, both deliberate. There is no separate instruction field
 * beyond the one on step 1 — that line is mirrored onto the platform's instruction row when
 * it saves. And there is no marking queue inside it: the handoff drew one on step 4, and
 * plan 51 §3.5 keeps the one queue the platform already has, with step 4 linking into it.
 */
export function ShortAnswerBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: ShortAnswerBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  /**
   * The document as this page found it.
   *
   * A save the author never presses is the right default — the five builders before this
   * one work the same way, and an exercise waits in its draft until the module is
   * published, so nothing typed here reaches a student either way. What that costs is the
   * oldest undo there is: reloading the page no longer brings back what was there before,
   * because autosave has already written it. This is what gives that back — state that is
   * set once and never again, so it stays put while the document moves under it.
   */
  const [opened] = useState(initialExercise);

  const autosave = useShortAnswerAutosave({
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

  /** The layer's findings, in the same rail and the same gate as the type's own. */
  const audioProblems = useAudioProblems(
    exercise.audio,
    exercise.questions.map((question) => question.id),
    AUDIO_STEPS,
  );

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
          The bar carries the rail and the save hint — `Saving… / Saved`, and nothing about
          a save that did not work: those are raised as a toast or a dialog, where there is
          room to say what happened (`builder-save-notices.tsx`). No button of its own; the
          gate is the way out of the last step, which is where the author arrives having
          answered the four.
        */}
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <ShortAnswerSteps
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
        {step === 1 && <StepQuestions exercise={exercise} onChange={setExercise} />}
        {step === 2 && <StepKey exercise={exercise} onChange={setExercise} />}
        {step === 3 && <StepVerdict exercise={exercise} onChange={setExercise} />}
        {step === 4 && (
          <StepReview exercise={exercise} containerId={containerId} onChange={setExercise} />
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => t(`shortAnswer.shell.step${n}` as 'shortAnswer.shell.step1')}
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
        Rare, and it throws away everything typed since the page opened — so it is a plain
        link rather than a button competing with the way forward, and it asks first. Hidden
        while there is nothing to undo.
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

      {/*
        The one save state that is a question rather than a report. Reading the other
        version means leaving this one, so it is a reload and not a silent swap: the
        author's unsaved work is on screen, and nothing may take it away without saying so.
      */}
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
 * the server's preflight reads too, and a rail that worked it out for itself would be a
 * second opinion about the same document.
 */
function ShortAnswerSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: ShortAnswerDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = t(`shortAnswer.shell.step${step}` as 'shortAnswer.shell.step1');
    const sub = t(`shortAnswer.shell.stepSub${step}` as 'shortAnswer.shell.stepSub1');

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
    // Plan 51 §6.5: `empty` is in the kernel's type because the handoff names it, and it
    // is unreachable — both ways into it on step 1 are blockers, so `err` answers first.
    // Drawn anyway rather than asserted away: a rail that threw on it would turn a rule
    // change into a crash.
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
      label={t('shortAnswer.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * `info` issues are left out: the gate answers "may this reach a student", and an
 * observation that changes no answer would sit in the list looking like something to fix.
 * They belong inline on the step that owns them — which, for this type, is where the
 * audit's advice about short and single anchors lives (plan 51 phase 5: problems are shown
 * on the step, not only in the gate).
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
  exercise: ShortAnswerDocument;
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
 *
 * The line that carries the most is the second one — every model answer passes its own key.
 * It is the one claim in this builder that is not a setting but a result, and it is the
 * difference between a key that has been tested and a key that has merely been written.
 * When it does not hold, the matching blocker is already in the list above, so the pass
 * line simply stays away rather than restating the bad news.
 */
function usePasses(exercise: ShortAnswerDocument): string[] {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const ready = gradeableQuestions(exercise);
  const cov = coverage(exercise);

  return [
    t('shortAnswer.gate.questions', { count: ready.length, anchors: cov.anchors }),
    cov.total > 0 && cov.done === cov.total ? t('shortAnswer.gate.modelsPass') : null,
    s.passRule === 'all'
      ? t('shortAnswer.gate.passAll')
      : t('shortAnswer.gate.passN', { n: s.passN }),
    s.minWords > 0
      ? t('shortAnswer.gate.minWords', { count: s.minWords })
      : t('shortAnswer.gate.minWordsOff'),
    s.showModel === 'never'
      ? t('shortAnswer.gate.modelNever')
      : s.showModel === 'always'
        ? t('shortAnswer.gate.modelAlways')
        : t('shortAnswer.gate.modelOnClose'),
    s.teacherReview === 'all'
      ? t('shortAnswer.gate.teacherAll')
      : s.teacherReview === 'flagged'
        ? t('shortAnswer.gate.teacherFlagged')
        : null,
    s.aiStage ? t('shortAnswer.gate.ai') : t('shortAnswer.gate.aiOff'),
  ].filter((line): line is string => line !== null);
}
