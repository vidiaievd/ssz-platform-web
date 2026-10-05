'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  issues,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/inflection-table';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderStepNav, type GateRow } from '../builder-frame';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { InflectionTableDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepForms } from './step-forms';
import { StepParadigm } from './step-paradigm';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

export interface InflectionTableBuilderProps {
  exerciseId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: InflectionTableDocument;
  onDocumentChange?: (exercise: InflectionTableDocument) => void;
}

/**
 * The `inflection_table` builder: five steps — paradigm, forms, reasons, difficulty, audio
 * (plan 69 §7.1). This is its frame and the first two steps; the rest, the autosave and the
 * preview arrive with phase 7.
 *
 * The rail is not a wizard and nothing is gated until the gate. Everything derived is the
 * kernel's: the rail dots, the signals inside each step and the gate are one issue list read
 * three ways, and it is the list the server's publish preflight runs (IT-B1).
 */
export function InflectionTableBuilder({
  exerciseId,
  initialExercise,
  onDocumentChange,
}: InflectionTableBuilderProps) {
  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const names = useStepNames();

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  const problems = useMemo(() => issues(exercise), [exercise]);

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <InflectionTableSteps current={step} exercise={exercise} onSelect={setStep} />
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
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target as IssueStep);
          setGateOpen(false);
        }}
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
  onSelect,
}: {
  current: IssueStep;
  exercise: InflectionTableDocument;
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');
  const names = useStepNames();

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = stepState(exercise, step);
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
 * step. A filter over `issues` and nothing more (IT-B1). The axes are the shared card under
 * the builder, not repeated here (deviation 6).
 */
function GateDialog({
  open,
  exercise,
  problems,
  onOpenChange,
  onGoToStep,
}: {
  open: boolean;
  exercise: InflectionTableDocument;
  problems: Issue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const copy = useIssueCopy(exercise);

  const row = (issue: Issue, level: GateRow['level'], index: number): GateRow => ({
    key: `${level}-${issue.code}-${index}`,
    level,
    text: copy.describe(issue),
    step: issue.step,
    action: copy.fix(issue),
  });

  const rows: GateRow[] = [
    ...problems.filter((issue) => issue.level === 'blocker').map((i, n) => row(i, 'blocker', n)),
    ...problems.filter((issue) => issue.level === 'warning').map((i, n) => row(i, 'warning', n)),
  ];

  return (
    <BuilderGateDialog
      open={open}
      rows={rows}
      passes={[]}
      onOpenChange={onOpenChange}
      onGoToStep={onGoToStep}
    />
  );
}
