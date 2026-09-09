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
import type { AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';
import {
  answerableQuestions,
  coverage,
  filledOptions,
  issues,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/multiple-choice';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepQuestions } from './step-questions';
import { StepDistractors } from './step-distractors';
import { StepDifficulty } from './step-difficulty';
import { StepFeedback } from './step-feedback';
import type { MultipleChoiceDocument } from './edits';
import {
  sameDocument,
  useMultipleChoiceAutosave,
  type SavedDocument,
} from './use-multiple-choice-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];
const LAST_STEP = 4;

/**
 * Where this builder keeps each part of the audio layer — INTEGRATION.md's one per-type
 * mapping. The clip and the timecodes are material (step 1), the rules are difficulty
 * (step 3), the transcript is feedback (step 4).
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 3, transcript: 4 };

export interface MultipleChoiceBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The course's language, as an ISO 639-1 code. Decides which audit rules can speak. */
  targetLanguage: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: MultipleChoiceDocument;
  onDocumentChange?: (exercise: MultipleChoiceDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The multiple-choice builder: four steps, one document, a rail that says where the
 * problems are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard, and nothing is gated: writing a question and deciding what a
 * wrong pick is told are the same job done at different moments, and an author who
 * notices on step 4 that their distractor is unanswerable will fix it on step 1 and come
 * back. What each step *is* is a different reading of the same set — the questions
 * themselves, then their wrong options, then how much help the student gets, then what the
 * set says after a pick.
 *
 * Everything derived comes from the kernel: the rail dots, the inline problems on each
 * step and the gate are one issue list filtered three ways. That is IMPLEMENTATION.md's
 * rule taken literally — "every validation surface in the UI is a filter over its output;
 * re-deriving rules per screen is how the builder drifts" — and it is the same list the
 * server's publish preflight runs, so the gate cannot promise what publication refuses.
 *
 * The eighth builder on the shared frame and the last of the thirteen templates to get
 * one. `multiple_choice` was the platform's default exercise type, which is exactly why it
 * was still being written in the generic form while every other type had moved on.
 */
export function MultipleChoiceBuilder({
  exerciseId,
  containerId,
  targetLanguage,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: MultipleChoiceBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  /**
   * The document as this page found it.
   *
   * A save the author never presses is the right default — the seven builders before this
   * one work the same way, and an exercise waits in its draft until the module is
   * published, so nothing typed here reaches a student either way. What that costs is the
   * oldest undo there is: reloading no longer brings back what was there before, because
   * autosave has already written it. This is what gives that back — state set once and
   * never again, so it stays put while the document moves under it.
   */
  const [opened] = useState(initialExercise);

  const autosave = useMultipleChoiceAutosave({
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

  const problems = useMemo(
    () => issues(exercise, { language: targetLanguage }),
    [exercise, targetLanguage],
  );

  /**
   * The audio layer's own findings, placed on this builder's steps.
   *
   * Merged into every surface rather than shown in a section of their own: the rail, the
   * gate and the server's preflight read one list, and an author who has switched
   * listening on has one exercise to finish, not two.
   */
  const audioProblems = useAudioProblems(
    exercise.audio,
    exercise.questions.map((q) => q.id),
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
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <MultipleChoiceSteps
            current={step}
            exercise={exercise}
            targetLanguage={targetLanguage}
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
        {step === 2 && (
          <StepDistractors
            exercise={exercise}
            onChange={setExercise}
            language={targetLanguage}
          />
        )}
        {step === 3 && <StepDifficulty exercise={exercise} onChange={setExercise} />}
        {step === 4 && <StepFeedback exercise={exercise} onChange={setExercise} />}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => t(`multipleChoice.shell.step${n}` as 'multipleChoice.shell.step1')}
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
 * the server's publish preflight reads too, and a rail that worked it out for itself would
 * be a second opinion about the same document.
 *
 * `empty` is reachable here, unlike in the two builders before it, and it is not a gap:
 * step 3 has no rule about questions at all, so on an untouched scaffold it honestly says
 * "nothing written yet" instead of a green dot claiming the difficulty is settled.
 */
function MultipleChoiceSteps({
  current,
  exercise,
  targetLanguage,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: MultipleChoiceDocument;
  targetLanguage: string;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const kernelState = stepState(exercise, step, { language: targetLanguage });
    const label = t(`multipleChoice.shell.step${step}` as 'multipleChoice.shell.step1');
    const sub = t(`multipleChoice.shell.stepSub${step}` as 'multipleChoice.shell.stepSub1');

    const state = foldAudioIntoStep(
      kernelState,
      audioProblems.filter((issue) => issue.step === step),
    );

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
      label={t('multipleChoice.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * A filter over `issues` and nothing more — no rule of its own, which is what makes the
 * modal, the rail and the step-level messages incapable of disagreeing. `info` findings
 * are left out: the handoff keeps them inline on step 2, and an observation about a habit
 * on a list of things to fix before assigning would be read as one more chore.
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
  exercise: MultipleChoiceDocument;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const describeIssue = useIssueCopy(exercise);
  const audioRows = useAudioGateRows(audioProblems);

  const rows: GateRow[] = [
    ...problems
      .filter((issue) => issue.level === 'blocker')
      .map((issue, index) => ({
        key: `blocker-${issue.code}-${index}`,
        level: 'blocker' as const,
        text: describeIssue(issue),
        step: issue.step,
      })),
    // Blockers with blockers: an exercise that says "listen" and has nothing to play is
    // as unassignable as one with no key.
    ...audioRows,
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
 * What this set is about to do to a student, in the author's own numbers.
 *
 * Everything here is restated from what they already wrote, which is the point: they wrote
 * it one step at a time, and this is the only place it is read together. The line that
 * carries most is the last — how many tries a question gets, and that only the first one
 * scores. An author who set "unlimited" to be kind has made a set where the score is the
 * first guess, and this is the one screen that says so before a student meets it.
 */
function usePasses(exercise: MultipleChoiceDocument): string[] {
  const t = useTranslations('Authoring');

  const ready = answerableQuestions(exercise);
  const cov = coverage(exercise);
  const kinds = [...new Set(ready.map((q) => q.kind))];
  const average =
    ready.length === 0
      ? '0'
      : (
          ready.reduce((total, q) => total + filledOptions(q).length, 0) / ready.length
        ).toFixed(1);

  return [
    ready.length > 0
      ? t('multipleChoice.gate.questions', { count: ready.length, average })
      : null,
    kinds.length > 0
      ? t('multipleChoice.gate.kinds', {
          kinds: kinds
            .map((kind) => t(`multipleChoice.kinds.${kind}` as 'multipleChoice.kinds.grammar'))
            .join(' · '),
        })
      : null,
    cov.written > 0 ? t('multipleChoice.gate.feedback', { count: cov.written }) : null,
    exercise.settings.shuffle ? t('multipleChoice.gate.shuffle') : null,
    t(
      `multipleChoice.gate.retry${
        exercise.settings.retry === 'none'
          ? 'None'
          : exercise.settings.retry === 'one'
            ? 'One'
            : 'Unlimited'
      }` as 'multipleChoice.gate.retryNone',
    ),
  ].filter((line): line is string => line !== null);
}
