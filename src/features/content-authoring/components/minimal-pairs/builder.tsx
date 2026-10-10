'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useMyProfile } from '@/features/profile';
import { stepState, type IssueStep } from '@/lib/shared-kernel/minimal-pairs';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderStepNav } from '../builder-frame';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepHead } from '../highlight-in-text/parts';
import type { ClipSources } from './clip-sources';
import type { MinimalPairsDocument } from './edits';
import { StepClips } from './step-clips';
import { StepPairs } from './step-pairs';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

export interface MinimalPairsBuilderProps {
  exerciseId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: MinimalPairsDocument;
  onDocumentChange?: (exercise: MinimalPairsDocument) => void;
  /** Tests stand in for the network and the microphone; left out, the browser's. */
  sources?: ClipSources;
}

/**
 * The `minimal_pairs` builder: five steps — pairs, audio, probes, feedback, result (plan 72
 * §7.1).
 *
 * The rail is not a wizard and nothing is gated until the gate. Every dot is the kernel's
 * `stepState`, read off the same issue list the steps draw from and the server's publish
 * preflight runs. Steps 3–5, the gate, autosave and the preview are phase 8.
 */
export function MinimalPairsBuilder({
  exerciseId,
  initialExercise,
  onDocumentChange,
  sources,
}: MinimalPairsBuilderProps) {
  const names = useTranslations('Authoring.minimalPairs.shell');
  const t = useTranslations('Authoring.minimalPairs');
  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const profile = useMyProfile();
  const teacherVoice = profile.data?.displayName.trim() ?? '';

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
        {step === 3 && (
          <StepHead eyebrow={t('step3.eyebrow')} title={t('step3.title')} lede={t('step3.lede')} />
        )}
        {step === 4 && (
          <StepHead eyebrow={t('step4.eyebrow')} title={t('step4.title')} lede={t('step4.lede')} />
        )}
        {step === 5 && (
          <StepHead eyebrow={t('step5.eyebrow')} title={t('step5.title')} lede={t('step5.lede')} />
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => names(`step${n as IssueStep}`)}
          onSelect={(next) => setStep(next as IssueStep)}
          // The gate is phase 8; until then «Done» has nowhere to go.
          onDone={() => undefined}
        />
      </div>
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
