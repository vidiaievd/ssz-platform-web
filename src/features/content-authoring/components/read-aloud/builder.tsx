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
  formatSeconds,
  issues,
  longestMax,
  rubricMax,
  stepState,
  withNoteCount,
  type Issue,
  type IssueContext,
  type IssueStep,
} from '@/lib/shared-kernel/read-aloud';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { ReadAloudDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepFlow } from './step-flow';
import { StepListen } from './step-listen';
import { StepRecording } from './step-recording';
import { StepRubric } from './step-rubric';
import { StepTask } from './step-task';
import { sameDocument, useReadAloudAutosave, type SavedDocument } from './use-read-aloud-autosave';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

/**
 * Where the audio layer's findings go: all of them on step 1, where its card sits (plan 70
 * §4.3). The clip is one model reading or one partner line over the whole exercise — no
 * per-prompt timecodes, and the transcript policy is the layer's own.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 1, transcript: 1 };

export interface ReadAloudBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: ReadAloudDocument;
  onDocumentChange?: (exercise: ReadAloudDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The `read_aloud` builder: five steps — task, what we listen for, rubric, recording, flow
 * (plan 70 §7.1), saved as the author works.
 *
 * The rail is not a wizard and nothing is gated until the gate. Everything derived is the
 * kernel's: the rail dots, the signals inside each step and the gate are one issue list read
 * three ways, and it is the list the server's publish preflight runs, so the gate cannot promise
 * what publication refuses (RA-B1, RA-B15, RA-B20).
 */
export function ReadAloudBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: ReadAloudBuilderProps) {
  const t = useTranslations('Authoring');
  const names = useTranslations('Authoring.readAloud.shell');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  /** The document as this page found it — the undo autosave would otherwise take away. */
  const [opened] = useState(initialExercise);

  const autosave = useReadAloudAutosave({
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

  const ctx = useMemo<IssueContext>(
    () => ({ audio: exercise.audio.audio.enabled }),
    [exercise.audio.audio.enabled],
  );
  const problems = useMemo(() => issues(exercise, ctx), [exercise, ctx]);
  const audioProblems = useAudioProblems(exercise.audio, [], AUDIO_STEPS);

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
          <ReadAloudSteps
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
        {step === 1 && <StepTask exercise={exercise} onChange={setExercise} />}
        {step === 2 && <StepListen exercise={exercise} onChange={setExercise} />}
        {step === 3 && <StepRubric exercise={exercise} onChange={setExercise} />}
        {step === 4 && <StepRecording exercise={exercise} onChange={setExercise} />}
        {step === 5 && (
          <StepFlow exercise={exercise} containerId={containerId} onChange={setExercise} />
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => names(`step${n as IssueStep}`)}
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

function ReadAloudSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: ReadAloudDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');
  const names = useTranslations('Authoring.readAloud.shell');
  const ctx: IssueContext = { audio: exercise.audio.audio.enabled };

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step, ctx),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = names(`step${step}`);
    const sub = names(`stepSub${step}`);

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
      onSelect={(next) => onSelect(next as IssueStep)}
      label={names('stepsLabel')}
    />
  );
}

/**
 * The gate: blockers, then warnings, each with the prototype's fix label and a way to its step,
 * then what already passes. A filter over `issues` and nothing more (RA-B15). The axes are the
 * shared card under the builder, not repeated here (deviation 6).
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
  exercise: ReadAloudDocument;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const copy = useIssueCopy(exercise);
  const audioRows = useAudioGateRows(audioProblems);

  const row = (issue: Issue, index: number): GateRow => ({
    key: `${issue.level}-${issue.code}-${index}`,
    level: issue.level === 'blocker' ? 'blocker' : 'warning',
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

/** The prototype's «what already passes» lines (`AssignGate`), from the author's own settings. */
function usePasses(exercise: ReadAloudDocument): string[] {
  const t = useTranslations('Authoring.readAloud.gate');
  const r = exercise.recording;
  const shown = exercise.rubric.filter((c) => c.studentVisible).length;
  const everyNote =
    exercise.prompts.length > 0 && withNoteCount(exercise) === exercise.prompts.length;

  return [
    exercise.prompts.length > 0 ? t('prompts', { count: exercise.prompts.length }) : null,
    everyNote ? t('notes') : null,
    exercise.rubric.length > 0
      ? t('rubric', {
          count: exercise.rubric.length,
          pass: exercise.settings.passScore,
          max: rubricMax(exercise.rubric),
          shown,
        })
      : null,
    t(r.listenBack ? 'takesListen' : 'takes', {
      count: r.takes,
      time: formatSeconds(longestMax(exercise)),
    }),
    t('queue'),
    exercise.settings.revision === 'return' ? t('revision') : null,
  ].filter((line): line is string => line !== null);
}
