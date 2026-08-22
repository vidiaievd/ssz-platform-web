'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  issues,
  stepState,
  type Issue,
  type IssueStep,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepFrame } from './step-frame';
import { StepTask } from './step-task';
import { useWritingTaskAutosave, type SavedDocument } from './use-writing-task-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];
const LAST_STEP = 4;

export interface WritingTaskBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: WritingTask;
  onDocumentChange?: (exercise: WritingTask) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The writing-task builder: four steps, one document, a rail that says where the problems
 * are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring is not
 * linear: the must-cover points written in step 1 are what the rubric's first criterion
 * marks in step 3, and the word range set in step 2 is what makes the step-3 tester say
 * a text is too short. The teacher will go back.
 *
 * Two things this builder does not have, both deliberate. There is no separate
 * instruction field: the one line the student reads lives in the document (step 1) and is
 * mirrored onto the platform's instruction row when it saves. And there is no marking
 * queue inside it — plan 50 §3.3 keeps the one queue the platform already has, and step 4
 * links into it rather than growing a second one.
 */
export function WritingTaskBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: WritingTaskBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useWritingTaskAutosave({
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
  const blockerCount = problems.filter((issue) => issue.level === 'blocker').length;

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 items-stretch justify-between gap-3">
          <WritingTaskSteps current={step} exercise={exercise} onSelect={setStep} />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <BuilderSaveHint
              status={autosave.status}
              savedAt={autosave.savedAt}
              canOverwrite={autosave.canOverwrite}
              onRetry={autosave.retry}
              onOverwrite={autosave.overwrite}
            />
            <Button type="button" onClick={() => setGateOpen(true)}>
              {t('builder.done')}
              {blockerCount > 0 && (
                <span className="ml-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-error px-1.5 text-[11px] font-bold text-white">
                  {blockerCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && <StepTask exercise={exercise} onChange={setExercise} />}
        {step === 2 && <StepFrame exercise={exercise} onChange={setExercise} />}

        {/* Steps 3-4 arrive one commit at a time; the rail is navigable meanwhile. */}
        {step > 2 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t(`writingTask.shell.step${step}` as 'writingTask.shell.step1')}
          </p>
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => t(`writingTask.shell.step${n}` as 'writingTask.shell.step1')}
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

/**
 * Where the problems are, per step, in the rail every builder shares.
 *
 * The state of a step is the kernel's answer, not this component's: `stepState` is what
 * the server's pre-flight reads too, and a rail that worked it out for itself would be a
 * second opinion about the same document.
 */
function WritingTaskSteps({
  current,
  exercise,
  onSelect,
}: {
  current: IssueStep;
  exercise: WritingTask;
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = stepState(exercise, step);
    const label = t(`writingTask.shell.step${step}` as 'writingTask.shell.step1');
    const sub = t(`writingTask.shell.stepSub${step}` as 'writingTask.shell.stepSub1');

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
      label={t('writingTask.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * `info` issues are left out: the gate answers "may this reach a student", and an
 * observation that changes no answer would sit in the list looking like something to fix.
 * They belong inline on the step that owns them.
 */
function GateDialog({
  open,
  exercise,
  problems,
  onOpenChange,
  onGoToStep,
}: {
  open: boolean;
  exercise: WritingTask;
  problems: Issue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const describeIssue = useIssueCopy(exercise);

  const rows: GateRow[] = [
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
      onOpenChange={onOpenChange}
      onGoToStep={onGoToStep}
    />
  );
}
