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
  coverage,
  issues,
  readyQuestions,
  stepState,
  tokenize,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/highlight-in-text';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { HighlightInTextDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepDifficulty } from './step-difficulty';
import { StepFeedback } from './step-feedback';
import { StepQuestions } from './step-questions';
import { StepText } from './step-text';
import {
  sameDocument,
  useHighlightInTextAutosave,
  type SavedDocument,
} from './use-highlight-in-text-autosave';

const STEPS: IssueStep[] = [1, 2, 3, 4];
const LAST_STEP = 4;

/**
 * The whole audio layer lives on step 4 — the handoff's place for it. One clip over the
 * passage: there are no items, so no per-item timecodes or recordings to put elsewhere.
 */
const AUDIO_STEPS: AudioStepMap = { source: 4, segments: 4, rules: 4, transcript: 4 };

export interface HighlightInTextBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: HighlightInTextDocument;
  onDocumentChange?: (exercise: HighlightInTextDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The `highlight_in_text` builder: four steps — the passage, the questions and their marks,
 * what the verdict says, and how the exercise is delivered (plan 67 §7.2).
 *
 * The rail is not a wizard and nothing is gated until the gate. Everything derived is the
 * kernel's: the rail dots, the inline signals on each step and the gate are one issue list
 * read three ways, and it is the list the server's publish preflight runs, so the gate
 * cannot promise what publication refuses (AC-X1, AC-X2).
 *
 * Unlike `sort_into_buckets`, a blank draft shows its blockers on the rail from the first
 * mount — steps 1 and 2 in red with their counts (AC-A1; step 3 stays grey, Q6-A).
 */
export function HighlightInTextBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: HighlightInTextBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  /** The document as this page found it — the undo autosave would otherwise take away. */
  const [opened] = useState(initialExercise);

  const autosave = useHighlightInTextAutosave({
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
  const audioProblems = useAudioProblems(exercise.audio, [], AUDIO_STEPS);

  const setAudio = (audio: HighlightInTextDocument['audio']) =>
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
          <HighlightInTextSteps
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
        {step === 1 && <StepText exercise={exercise} onChange={setExercise} />}
        {step === 2 && (
          <StepQuestions
            exercise={exercise}
            onChange={setExercise}
            onGoStep={(target) => setStep(target)}
          />
        )}
        {step === 3 && <StepFeedback exercise={exercise} onChange={setExercise} />}
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
          stepLabel={(n) => t(`highlightInText.shell.step${n}` as 'highlightInText.shell.step1')}
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

/** The rail: `Text · one passage`, `Questions · what to mark`, … with the kernel's dot per step. */
function HighlightInTextSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: HighlightInTextDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = t(`highlightInText.shell.step${step}` as 'highlightInText.shell.step1');
    const sub = t(`highlightInText.shell.stepSub${step}` as 'highlightInText.shell.stepSub1');

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
      label={t('highlightInText.shell.stepsLabel')}
    />
  );
}

/**
 * The gate: blockers, then warnings, each with the prototype's fix label and a way to its
 * step, then what already passes. A filter over `issues` and nothing more (AC-X1). The axes
 * are the shared card under the builder, not repeated here (deviation 6).
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
  exercise: HighlightInTextDocument;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const copy = useIssueCopy(exercise);
  const audioRows = useAudioGateRows(audioProblems);

  const row = (issue: Issue, index: number): GateRow => ({
    key: `${issue.level}-${issue.code}-${index}`,
    level: issue.level,
    text: copy.describe(issue),
    step: issue.step,
    action: copy.fix(issue),
  });

  const rows: GateRow[] = [
    ...audioRows.filter((r) => r.level === 'blocker'),
    ...problems.filter((issue) => issue.level === 'blocker').map(row),
    ...audioRows.filter((r) => r.level === 'warning'),
    ...problems.filter((issue) => issue.level === 'warning').map(row),
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

/** The prototype's five «what already passes» lines (`AssignGate`). */
function usePasses(exercise: HighlightInTextDocument): string[] {
  const t = useTranslations('Authoring.highlightInText.gate');

  const ready = readyQuestions(exercise);
  const cov = coverage(exercise);
  const words = tokenize(exercise.text).length;
  const marks = ready.reduce((n, q) => n + q.spans.length, 0);

  return [
    ready.length > 0 ? t('questions', { count: ready.length, words, marks }) : null,
    ready.length > 0 && ready.every((q) => q.missHint.trim() !== '') ? t('missExplained') : null,
    cov.written > 0 ? t('reasons', { count: cov.written }) : null,
    exercise.settings.penalty !== 'off' ? t('penalty') : null,
    exercise.orphans.length === 0 ? t('noOrphans') : null,
  ].filter((line): line is string => line !== null);
}
