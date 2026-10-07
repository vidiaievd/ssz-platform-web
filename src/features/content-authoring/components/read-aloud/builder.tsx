'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';
import { stepState, type IssueContext, type IssueStep } from '@/lib/shared-kernel/read-aloud';

import { foldAudioIntoStep, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderStepNav } from '../builder-frame';
import { EditorToolbarPortal } from '../editor-toolbar';
import type { ReadAloudDocument } from './edits';
import { StepListen } from './step-listen';
import { StepRubric } from './step-rubric';
import { StepTask } from './step-task';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

/**
 * Where the audio layer's findings go: all of them on step 1, where its card sits (plan 70
 * §4.3). The clip is one model reading or one partner line over the whole exercise — no
 * per-prompt timecodes, and the transcript policy is the layer's own.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 1, transcript: 1 };

export interface ReadAloudBuilderProps {
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: ReadAloudDocument;
  onDocumentChange?: (exercise: ReadAloudDocument) => void;
}

/**
 * The `read_aloud` builder: five steps — task, what we listen for, rubric, recording, flow
 * (plan 70 §7.1).
 *
 * The rail is not a wizard: steps are reachable in any order, and the dots are the kernel's
 * `stepState`, the same issue list the server's publish preflight runs (RA-B1). Steps 4 and 5,
 * the gate, the autosave and the preview arrive with phase 8; until then the rail already shows
 * their dots, so a blocker that lives there is visible from the first mount.
 */
export function ReadAloudBuilder({ initialExercise, onDocumentChange }: ReadAloudBuilderProps) {
  const t = useTranslations('Authoring.readAloud.shell');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  const audioProblems = useAudioProblems(exercise.audio, [], AUDIO_STEPS);

  const label = (n: number) => t(`step${n as IssueStep}`);

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
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && <StepTask exercise={exercise} onChange={setExercise} />}
        {step === 2 && <StepListen exercise={exercise} onChange={setExercise} />}
        {step === 3 && <StepRubric exercise={exercise} onChange={setExercise} />}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={label}
          onSelect={(next) => setStep(next as IssueStep)}
          onDone={() => undefined}
        />
      </div>
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
