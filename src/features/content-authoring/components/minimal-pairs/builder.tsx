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
import { useMyProfile } from '@/features/profile';
import {
  contrastsInSet,
  issues,
  missingClips,
  readyPairs,
  stepState,
  syntheticCount,
  wordCount,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/minimal-pairs';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { ClipSources } from './clip-sources';
import type { MinimalPairsDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepClips } from './step-clips';
import { StepFeedback } from './step-feedback';
import { StepPairs } from './step-pairs';
import { StepProbes } from './step-probes';
import { StepResult } from './step-result';
import {
  sameDocument,
  useMinimalPairsAutosave,
  type SavedDocument,
} from './use-minimal-pairs-autosave';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

export interface MinimalPairsBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: MinimalPairsDocument;
  onDocumentChange?: (exercise: MinimalPairsDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
  /** Tests stand in for the network and the microphone; left out, the browser's. */
  sources?: ClipSources;
}

/**
 * The `minimal_pairs` builder: five steps — pairs, audio, probes, feedback, result (plan 72
 * §7.1).
 *
 * The rail is not a wizard and nothing is gated until the gate. Every dot is the kernel's
 * `stepState`, and the signals inside the steps and the gate are the same issue list read three
 * ways — the list the server's publish preflight runs, so the gate cannot promise what
 * publication refuses (MP-B27, MP-B28, MP-B30). Saved as the author works.
 */
export function MinimalPairsBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
  sources,
}: MinimalPairsBuilderProps) {
  const names = useTranslations('Authoring.minimalPairs.shell');
  const t = useTranslations('Authoring');
  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  /** The document as this page found it — the undo autosave would otherwise take away. */
  const [opened] = useState(initialExercise);
  const profile = useMyProfile();
  const teacherVoice = profile.data?.displayName.trim() ?? '';

  const autosave = useMinimalPairsAutosave({
    exerciseId,
    containerId,
    exercise,
    onSaved: (updatedAt, saved) => {
      setExercise((current) => ({ ...current, updatedAt }));
      onSavedRemote?.(updatedAt, saved);
    },
  });

  const problems = useMemo(() => issues(exercise), [exercise]);
  const changedSinceOpen = !sameDocument(exercise, opened);

  const revert = () => {
    // The token of the row as it stands, on the document as it was: the write has to land on the
    // version autosave last wrote, or it would be refused as somebody else's.
    setExercise({ ...opened, updatedAt: exercise.updatedAt });
    setRevertOpen(false);
  };

  useBuilderSaveNotices({
    status: autosave.status,
    rejection: autosave.rejection,
    failures: autosave.failures,
    onRetry: autosave.retry,
  });

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <MinimalPairsSteps current={step} exercise={exercise} onSelect={setStep} />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <BuilderSaveHint status={autosave.status} savedAt={autosave.savedAt} />
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && <StepPairs exercise={exercise} onChange={setExercise} />}
        {step === 2 && (
          <StepClips
            exercise={exercise}
            exerciseId={exerciseId}
            teacherVoice={teacherVoice}
            onChange={setExercise}
            {...(sources === undefined ? {} : { sources })}
          />
        )}
        {step === 3 && <StepProbes exercise={exercise} onChange={setExercise} />}
        {step === 4 && <StepFeedback exercise={exercise} onChange={setExercise} />}
        {step === 5 && <StepResult exercise={exercise} onChange={setExercise} />}

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

function MinimalPairsSteps({
  current,
  exercise,
  onSelect,
}: {
  current: IssueStep;
  exercise: MinimalPairsDocument;
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');
  const names = useTranslations('Authoring.minimalPairs.shell');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = stepState(exercise, step);
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
 * then what already passes (plan 72 §7.7). A filter over `issues` and nothing more (MP-B28). The
 * axes are the shared card under the builder, not repeated here, and so is the evidence line —
 * the notes at the foot of the prototype's gate are the card's to say.
 */
function GateDialog({
  open,
  exercise,
  problems,
  onOpenChange,
  onGoToStep,
}: {
  open: boolean;
  exercise: MinimalPairsDocument;
  problems: Issue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const copy = useIssueCopy(exercise);

  const row = (issue: Issue, index: number): GateRow => ({
    key: `${issue.level}-${issue.code}-${index}`,
    level: issue.level === 'blocker' ? 'blocker' : 'warning',
    text: copy.describe(issue),
    step: issue.step,
    action: copy.fix(issue),
  });

  const rows: GateRow[] = [
    ...problems.filter((issue) => issue.level === 'blocker').map(row),
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
function usePasses(exercise: MinimalPairsDocument): string[] {
  const t = useTranslations('Authoring.minimalPairs.gate');
  const ready = readyPairs(exercise).length;
  const words = wordCount(exercise);
  const { set, feedback, scoring } = exercise;
  const families = contrastsInSet(exercise).filter((id) => id !== '');
  const contrasts = families.join(' · contrast:');

  const memory =
    scoring.memory === 'none'
      ? t('memoryNone')
      : scoring.memory === 'contrast+word'
        ? t('memoryWords', { id: contrasts })
        : scoring.logWordExposure
          ? t('memoryContrastExposure', { id: contrasts })
          : t('memoryContrast', { id: contrasts });

  return [
    ready > 0 ? t('pairs', { ready, words, clips: words - missingClips(exercise) }) : null,
    t('probes', { count: set.probes, how: t(`sampling.${set.sampling}`) }),
    t('plays', {
      replays:
        set.playsPerProbe === 0
          ? t('playsUnlimited')
          : t('playsLimited', { count: set.playsPerProbe }),
      verdict: !feedback.immediate
        ? t('verdictLater')
        : feedback.abCompare
          ? t('verdictAb')
          : t('verdictNow'),
    }),
    t('graded', { pass: scoring.passPct }),
    families.length > 0 ? memory : null,
    syntheticCount(exercise) === 0 ? t('noSynthetic') : null,
  ].filter((line): line is string => line !== null);
}
