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
  balance,
  buckets,
  coverage,
  issues,
  passMark,
  readyItems,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/sort-into-buckets';

import type { AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepBuckets } from './step-buckets';
import { StepItems } from './step-items';
import { StepFeedback } from './step-feedback';
import { StepDifficulty } from './step-difficulty';
import type { SortIntoBucketsDocument } from './edits';
import {
  sameDocument,
  useSortIntoBucketsAutosave,
  type SavedDocument,
} from './use-sort-into-buckets-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * Where this builder keeps each part of the audio layer: the clip and the rules with the
 * delivery settings on step 4 (the spec's place), the timecodes and recordings with the
 * items on step 2, the transcript with the explanations on step 3.
 */
const AUDIO_STEPS: AudioStepMap = { source: 4, segments: 2, rules: 4, transcript: 3 };
const LAST_STEP = 4;

export interface SortIntoBucketsBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The course's language, as an ISO 639-1 code. Decides which audit rules can speak. */
  targetLanguage: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: SortIntoBucketsDocument;
  onDocumentChange?: (exercise: SortIntoBucketsDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The sort-into-buckets builder: four steps — the buckets, the items and where each
 * belongs, why a wrong bucket is wrong, and how the task is delivered.
 *
 * The rail is not a wizard and nothing is gated until the gate: an author who notices on
 * step 3 that two buckets overlap will fix them on step 1 and come back.
 *
 * Everything derived is the kernel's. The rail dots, the inline findings on each step and
 * the gate are one issue list filtered three ways, and it is the list the server's publish
 * preflight runs, so the gate cannot promise what publication refuses (AC-X1).
 */
export function SortIntoBucketsBuilder({
  exerciseId,
  containerId,
  targetLanguage,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: SortIntoBucketsBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  /**
   * The document as this page found it.
   *
   * A save the author never presses is the right default — the eight builders before this
   * one work the same way, and an exercise waits in its draft until the module is
   * published, so nothing typed here reaches a student either way. What that costs is the
   * oldest undo there is: reloading no longer brings back what was there before, because
   * autosave has already written it. This is what gives that back — state set once and
   * never again, so it stays put while the document moves under it.
   */
  const [opened] = useState(initialExercise);

  const autosave = useSortIntoBucketsAutosave({
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
    // The tiles carry their recordings, not just their ids: under `source: 'items'` what
    // makes the exercise playable is that some tile has one.
    exercise.items.map((item) => ({
      id: item.id,
      ...(item.mediaId ? { clip: item.mediaId } : {}),
    })),
    AUDIO_STEPS,
  );

  const setAudio = (audio: SortIntoBucketsDocument['audio']) =>
    setExercise((current) => ({ ...current, audio }));

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
          <SortIntoBucketsSteps
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
          <StepBuckets exercise={exercise} onChange={setExercise} language={targetLanguage} />
        )}
        {step === 2 && (
          <StepItems
            exercise={exercise}
            onChange={setExercise}
            audio={exercise.audio}
            onAudioChange={setAudio}
          />
        )}
        {step === 3 && (
          <StepFeedback
            exercise={exercise}
            onChange={setExercise}
            audio={exercise.audio}
            onAudioChange={setAudio}
          />
        )}
        {step === 4 && (
          <StepDifficulty
            exercise={exercise}
            onChange={setExercise}
            audio={exercise.audio}
            onAudioChange={setAudio}
          />
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => t(`sortIntoBuckets.shell.step${n}` as 'sortIntoBuckets.shell.step1')}
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
 * The state of a step is the kernel's answer: `stepState` is what the server's preflight
 * reads too. It reports `empty` for an untouched step 1–3 rather than a wall of blockers
 * on a fresh document (plan 66 §4.2); the blockers themselves stay unconditional, so the
 * gate and the preflight still refuse an unfinished board.
 */
function SortIntoBucketsSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: SortIntoBucketsDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = t(`sortIntoBuckets.shell.step${step}` as 'sortIntoBuckets.shell.step1');
    const sub = t(`sortIntoBuckets.shell.stepSub${step}` as 'sortIntoBuckets.shell.stepSub1');

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
      label={t('sortIntoBuckets.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * A filter over `issues` and nothing more — no rule of its own, which is what makes the
 * modal, the rail and the step-level messages incapable of disagreeing. `info` findings are
 * left out: the handoff keeps them inline on step 2, and an observation about a habit on a
 * list of things to fix before assigning would be read as one more chore.
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
  exercise: SortIntoBucketsDocument;
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
 * What this task is about to do to a student, in the author's own numbers.
 *
 * Restated from what was written one step at a time; this is the only place it is read
 * together. The spread says whether the task can be passed without reading, and the pass
 * mark in items says what passing costs.
 */
function usePasses(exercise: SortIntoBucketsDocument): string[] {
  const t = useTranslations('Authoring');

  const ready = readyItems(exercise);
  const spread = balance(exercise);
  const cov = coverage(exercise);
  const s = exercise.settings;
  const key = (n: number) => (n === 0 ? 'Unlimited' : n === 1 ? 'One' : 'Several');

  return [
    ready.length > 0
      ? t('sortIntoBuckets.gate.items', { count: ready.length, buckets: buckets(exercise).length })
      : null,
    ready.length > 0
      ? t('sortIntoBuckets.gate.spread', {
          spread: spread
            .map((entry, at) => {
              const label = buckets(exercise)[at]?.label.trim() ?? '';
              return `${label === '' ? '—' : label} ${entry.count}`;
            })
            .join(' · '),
        })
      : null,
    ready.length > 0
      ? t('sortIntoBuckets.gate.passMark', {
          threshold: s.threshold,
          mark: passMark(s, ready.length),
          total: ready.length,
        })
      : null,
    cov.written > 0 ? t('sortIntoBuckets.gate.explanations', { count: cov.written }) : null,
    t(`sortIntoBuckets.gate.attempts${key(s.attempts)}` as 'sortIntoBuckets.gate.attemptsOne', {
      count: s.attempts,
    }),
    s.revealKey ? t('sortIntoBuckets.gate.keyShown') : t('sortIntoBuckets.gate.keyHidden'),
  ].filter((line): line is string => line !== null);
}
