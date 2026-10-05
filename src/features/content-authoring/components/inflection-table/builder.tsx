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
  formsCoverage,
  isLinked,
  issues,
  packOf,
  stepState,
  type Issue,
  type IssueCode,
  type IssueStep,
} from '@/lib/shared-kernel/inflection-table';

import { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { InflectionTableDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepAudio } from './step-audio';
import { StepDifficulty } from './step-difficulty';
import { StepForms } from './step-forms';
import { StepParadigm } from './step-paradigm';
import { StepReasons } from './step-reasons';
import {
  sameDocument,
  useInflectionTableAutosave,
  type SavedDocument,
} from './use-inflection-table-autosave';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

/**
 * Where the audio layer's findings go: all of it on step 5 — one clip over the whole table, no
 * per-cell timecodes and no transcript to hold back (plan 69 §7.6).
 */
const AUDIO_STEPS: AudioStepMap = { source: 5, segments: 5, rules: 5, transcript: 5 };

export interface InflectionTableBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: InflectionTableDocument;
  onDocumentChange?: (exercise: InflectionTableDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The `inflection_table` builder: five steps — paradigm, forms, reasons, difficulty, audio
 * (plan 69 §7.1), saved as the author works.
 *
 * The rail is not a wizard and nothing is gated until the gate. Everything derived is the
 * kernel's: the rail dots, the signals inside each step and the gate are one issue list read
 * three ways, and it is the list the server's publish preflight runs (IT-B1).
 */
export function InflectionTableBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: InflectionTableBuilderProps) {
  const t = useTranslations('Authoring');
  const names = useStepNames();

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  /** The document as this page found it — the undo autosave would otherwise take away. */
  const [opened] = useState(initialExercise);

  const autosave = useInflectionTableAutosave({
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

  const setAudio = (audio: InflectionTableDocument['audio']) =>
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
          <InflectionTableSteps
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
        {step === 1 && <StepParadigm exercise={exercise} onChange={setExercise} />}
        {step === 2 && (
          <StepForms
            exerciseId={exerciseId}
            exercise={exercise}
            onChange={setExercise}
            onGoToStep={(target) => setStep(target as IssueStep)}
          />
        )}
        {step === 3 && (
          <StepReasons
            exercise={exercise}
            onChange={setExercise}
            onGoToStep={(target) => setStep(target as IssueStep)}
          />
        )}
        {step === 4 && <StepDifficulty exercise={exercise} onChange={setExercise} />}
        {step === 5 && <StepAudio audio={exercise.audio} onAudioChange={setAudio} />}

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

/** The five steps' names and sub-lines, spelled out — no key is built from the number. */
function useStepNames() {
  const t = useTranslations('Authoring.inflectionTable.shell');
  const label = (step: IssueStep) =>
    step === 1
      ? t('step1')
      : step === 2
        ? t('step2')
        : step === 3
          ? t('step3')
          : step === 4
            ? t('step4')
            : t('step5');
  const sub = (step: IssueStep) =>
    step === 1
      ? t('stepSub1')
      : step === 2
        ? t('stepSub2')
        : step === 3
          ? t('stepSub3')
          : step === 4
            ? t('stepSub4')
            : t('stepSub5');
  return { label, sub, stepsLabel: t('stepsLabel') };
}

/** The rail: `Paradigm · columns from the pack`, … with the kernel's dot per step. */
function InflectionTableSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: InflectionTableDocument;
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
 * Codes that name one row, cell or column each — repeated, they are one line with a number
 * (plan 69 §4.2, item 7). The issue list keeps them apart; only the gate adds them up.
 */
const AGGREGATED: ReadonlySet<IssueCode> = new Set<IssueCode>([
  'IT_CELL_NO_KEY',
  'IT_CELL_NO_WHY',
  'IT_ROW_NO_LEMMA',
  'IT_ROW_ALL_GIVEN',
  'IT_DUPLICATE_LEMMA',
  'IT_SLOT_NEVER_ASKED',
  'IT_SLOT_GONE',
]);

/**
 * The gate: blockers, then warnings, each with the prototype's fix label and a way to its
 * step, then what already passes. A filter over `issues`, with repeats added up (IT-B1). The
 * axes are the shared card under the builder, not repeated here (deviation 6), and info is the
 * steps' to show — the gate's rows are what stands in the way.
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
  exercise: InflectionTableDocument;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const t = useTranslations('Authoring.inflectionTable.gate');
  const copy = useIssueCopy(exercise);
  const audioRows = useAudioGateRows(audioProblems);

  const rowsOf = (level: GateRow['level']): GateRow[] => {
    const own = problems.filter((issue) => issue.level === level);
    const out: GateRow[] = [];
    const done = new Set<IssueCode>();
    own.forEach((issue, index) => {
      if (done.has(issue.code)) return;
      const same = own.filter((other) => other.code === issue.code);
      if (AGGREGATED.has(issue.code) && same.length > 1) {
        done.add(issue.code);
        out.push({
          key: `${level}-${issue.code}`,
          level,
          text: t(`aggregate.${issue.code}` as 'aggregate.IT_CELL_NO_KEY', { count: same.length }),
          step: issue.step,
          action: copy.fix(issue),
        });
        return;
      }
      out.push({
        key: `${level}-${issue.code}-${index}`,
        level,
        text: copy.describe(issue),
        step: issue.step,
        action: copy.fix(issue),
      });
    });
    return out;
  };

  const rows: GateRow[] = [
    ...audioRows.filter((r) => r.level === 'blocker'),
    ...rowsOf('blocker'),
    ...audioRows.filter((r) => r.level === 'warning'),
    ...rowsOf('warning'),
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

/** The prototype's «what already passes» lines (`AssignGate`), each only when it is true. */
function usePasses(exercise: InflectionTableDocument): string[] {
  const t = useTranslations('Authoring.inflectionTable.gate');

  const cov = formsCoverage(exercise);
  const pack = packOf(exercise);
  const linked = exercise.rows.filter(isLinked).length;

  return [
    cov.asked > 0 ? t('cells', { count: cov.asked }) : null,
    cov.asked > 0 && cov.withWhy === cov.asked ? t('whyWritten') : null,
    exercise.settings.rowVerdict ? t('rowVerdict') : null,
    pack !== null ? t('pack', { pack: pack.label, language: exercise.language }) : null,
    linked > 0 ? t('linked', { count: linked }) : null,
  ].filter((line): line is string => line !== null);
}
