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
  placeAudioIssues,
  type AudioStepMap,
  type PlacedAudioIssue,
} from '@/lib/shared-kernel/audio';
import {
  allWords,
  audioIssuesOf,
  focusCoverage,
  issues,
  readySegments,
  stepState,
  timedCount,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/dictation';

import { foldAudioIntoStep, useAudioGateRows } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { DictationDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepDifficulty } from './step-difficulty';
import { StepKey } from './step-key';
import { StepMarking } from './step-marking';
import { StepRecording } from './step-recording';
import { sameDocument, useDictationAutosave, type SavedDocument } from './use-dictation-autosave';

const STEPS: IssueStep[] = [1, 2, 3, 4];
const LAST_STEP = 4;

/**
 * Where the audio layer's findings go (plan 68 Q3-A): the clip is step 1's, the timecodes of
 * the sentences step 2's, and the rules and the transcript policy step 4's. The kernel's
 * `audioIssuesOf` has already dropped the two codes this type silences.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 2, rules: 4, transcript: 4 };

export interface DictationBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: DictationDocument;
  onDocumentChange?: (exercise: DictationDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The `dictation` builder: four steps — the recording, the key, the marking and the
 * difficulty (plan 68 §7.3).
 *
 * The rail is not a wizard and nothing is gated until the gate. Everything derived is the
 * kernel's: the rail dots, the inline signals on each step and the gate are one issue list
 * read three ways, and it is the list the server's publish preflight runs, so the gate
 * cannot promise what publication refuses (AC-X1). A blank draft shows its blockers on the
 * rail from the first mount — steps 1 and 2 in red with their counts (AC-B1).
 */
export function DictationBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: DictationBuilderProps) {
  const t = useTranslations('Authoring');
  const names = useStepNames();

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  /**
   * Sentences whose timecode *Paste and split* only guessed (AC-B2). Session state, not part
   * of the document: it lives here so it survives a trip to another step.
   */
  const [estimated, setEstimated] = useState<ReadonlySet<string>>(() => new Set());
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  /** The document as this page found it — the undo autosave would otherwise take away. */
  const [opened] = useState(initialExercise);

  const autosave = useDictationAutosave({
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
  const audioProblems = useMemo(
    () => placeAudioIssues(audioIssuesOf(exercise), AUDIO_STEPS),
    [exercise],
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
          <DictationSteps
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
        {step === 1 && <StepRecording exercise={exercise} onChange={setExercise} />}
        {step === 2 && (
          <StepKey
            exercise={exercise}
            onChange={setExercise}
            estimated={estimated}
            onEstimatedChange={setEstimated}
          />
        )}
        {step === 3 && (
          <StepMarking exercise={exercise} onChange={setExercise} onBackToKey={() => setStep(2)} />
        )}
        {step === 4 && <StepDifficulty exercise={exercise} onChange={setExercise} />}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => names.label(n as IssueStep)}
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

/** The four steps' names and sub-lines, spelled out — no key is built from the number. */
function useStepNames() {
  const t = useTranslations('Authoring.dictation.shell');
  const label = (step: IssueStep) =>
    step === 1 ? t('step1') : step === 2 ? t('step2') : step === 3 ? t('step3') : t('step4');
  const sub = (step: IssueStep) =>
    step === 1
      ? t('stepSub1')
      : step === 2
        ? t('stepSub2')
        : step === 3
          ? t('stepSub3')
          : t('stepSub4');
  return { label, sub, stepsLabel: t('stepsLabel') };
}

/** The rail: `Text · one passage`, `Questions · what to mark`, … with the kernel's dot per step. */
function DictationSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: DictationDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');
  const names = useStepNames();

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = names.label(step);
    const sub = names.sub(step);

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
      label={names.stepsLabel}
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
  exercise: DictationDocument;
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
function usePasses(exercise: DictationDocument): string[] {
  const t = useTranslations('Authoring.dictation.gate');

  const ready = readySegments(exercise);
  const cov = focusCoverage(exercise);

  return [
    ready.length > 0 ? t('sentences', { count: ready.length, words: allWords(exercise) }) : null,
    ready.length > 0 && ready.every((s) => s.why.trim() !== '') ? t('whyWritten') : null,
    cov.written > 0 ? t('reasons', { count: cov.written }) : null,
    exercise.audio.settings.transcriptWhen !== 'always' ? t('transcriptClosed') : null,
    exercise.mode === 'segments' && timedCount(exercise) === exercise.segments.length
      ? t('replayable')
      : null,
  ].filter((line): line is string => line !== null);
}
