'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  placedAudioIssues,
  stepState,
  type IssueStep,
} from '@/lib/shared-kernel/information-transfer';
import type { PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { foldAudioIntoStep } from '../audio';
import { BuilderStepNav } from '../builder-frame';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { InformationTransferDocument } from './edits';
import { StepForm } from './step-form';
import { StepSource } from './step-source';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

export interface InformationTransferBuilderProps {
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: InformationTransferDocument;
  onDocumentChange?: (exercise: InformationTransferDocument) => void;
  /** «Done» on the last step — the gate, which phase 7 brings. */
  onDone?: () => void;
}

/**
 * The `information_transfer` builder, steps 1 and 2 (plan 73 phase 6): the source and the
 * blank. The rail already carries all five steps so that what the issue list says about the
 * later ones — the key the core cannot read, the delivery rules, the pass mark — shows from
 * the first mount; their bodies, the gate, autosave and the preview are phase 7's.
 *
 * Everything derived is the kernel's: the rail dots and the signals inside each step are one
 * issue list read two ways, and it is the list the server's publish preflight runs.
 */
export function InformationTransferBuilder({
  initialExercise,
  onDocumentChange,
  onDone,
}: InformationTransferBuilderProps) {
  const names = useStepNames();
  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  const audioProblems = useMemo(() => placedAudioIssues(exercise), [exercise]);

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <InformationTransferSteps
            current={step}
            exercise={exercise}
            audioProblems={audioProblems}
            onSelect={setStep}
          />
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && <StepSource exercise={exercise} onChange={setExercise} />}
        {step === 2 && <StepForm exercise={exercise} onChange={setExercise} />}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => names.label(n as IssueStep)}
          onSelect={(next) => setStep(next as IssueStep)}
          onDone={() => onDone?.()}
        />
      </div>
    </div>
  );
}

/** The five steps' names and sub-lines, spelled out — no key is built from the number. */
function useStepNames() {
  const t = useTranslations('Authoring.informationTransfer.shell');
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

/** The rail: `Source · text or recording`, `Blank · the fields`, … with the kernel's dot per step. */
function InformationTransferSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: InformationTransferDocument;
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
