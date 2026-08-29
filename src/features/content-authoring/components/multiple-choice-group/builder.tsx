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
  balance,
  coverage,
  issues,
  passMark,
  readyRows,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/multiple-choice-group';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepSetup } from './step-setup';
import { StepStatements } from './step-statements';
import { StepDifficulty } from './step-difficulty';
import { StepFeedback } from './step-feedback';
import type { MultipleChoiceGroupDocument } from './edits';
import {
  sameDocument,
  useMultipleChoiceGroupAutosave,
  type SavedDocument,
} from './use-multiple-choice-group-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];
const LAST_STEP = 4;

export interface MultipleChoiceGroupBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The course's language, as an ISO 639-1 code. Decides which audit rules can speak. */
  targetLanguage: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: MultipleChoiceGroupDocument;
  onDocumentChange?: (exercise: MultipleChoiceGroupDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The multiple-choice-group builder: four steps, one table, a rail that says where the
 * problems are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard, and nothing is gated: choosing the columns and writing the
 * statements are the same job done at different moments, and an author who notices on step
 * 4 that a statement has no key will fix it on step 2 and come back. What each step *is*
 * is a different reading of the same table — the text and the columns it is answered with,
 * then the statements and the key, then how much a mistake costs, then what the table says
 * once it has been checked.
 *
 * Everything derived comes from the kernel: the rail dots, the inline problems on each step
 * and the gate are one issue list filtered three ways. That is README's rule taken
 * literally — "every validation surface is a filter over its output; re-deriving rules per
 * screen is how the builder drifts" — and it is the same list the server's publish
 * preflight runs, so the gate cannot promise what publication refuses.
 *
 * The ninth builder on the shared frame, and the first whose subject is a *block* rather
 * than a set of independent items: one key spread over one table, checked in one go.
 */
export function MultipleChoiceGroupBuilder({
  exerciseId,
  containerId,
  targetLanguage,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: MultipleChoiceGroupBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  /**
   * The document as this page found it.
   *
   * A save the author never presses is the right default — the eight builders before this
   * one work the same way, and an exercise waits in its draft until the module is
   * published, so nothing typed here reaches a student either way. What that costs is the
   * oldest undo there is: reloading no longer brings back what was there before, because
   * autosave has already written it. This is what gives that back — state set once and
   * never again, so it stays put while the document moves under it.
   */
  const [opened] = useState(initialExercise);

  const autosave = useMultipleChoiceGroupAutosave({
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

  const problems = useMemo(
    () => issues(exercise, { language: targetLanguage }),
    [exercise, targetLanguage],
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
          <MultipleChoiceGroupSteps
            current={step}
            exercise={exercise}
            targetLanguage={targetLanguage}
            onSelect={setStep}
          />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <BuilderSaveHint status={autosave.status} savedAt={autosave.savedAt} />
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && <StepSetup exercise={exercise} onChange={setExercise} />}
        {step === 2 && (
          <StepStatements exercise={exercise} onChange={setExercise} language={targetLanguage} />
        )}
        {step === 3 && <StepDifficulty exercise={exercise} onChange={setExercise} />}
        {step === 4 && <StepFeedback exercise={exercise} onChange={setExercise} />}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) =>
            t(`multipleChoiceGroup.shell.step${n}` as 'multipleChoiceGroup.shell.step1')
          }
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

      {/*
        Rare, and it throws away everything typed since the page opened — so it is a plain
        link rather than a button competing with the way forward, and it asks first. Hidden
        while there is nothing to undo.
      */}
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

      {/*
        The one save state that is a question rather than a report. Reading the other
        version means leaving this one, so it is a reload and not a silent swap: the
        author's unsaved work is on screen, and nothing may take it away without saying so.
      */}
      <BuilderConflictDialog
        open={autosave.status === 'conflict'}
        onOverwrite={autosave.overwrite}
        onDiscard={() => window.location.reload()}
      />
    </div>
  );
}

/**
 * Where the problems are, per step, in the rail every builder shares.
 *
 * The state of a step is the kernel's answer, not this component's: `stepState` is what the
 * server's publish preflight reads too, and a rail that worked it out for itself would be a
 * second opinion about the same document.
 *
 * `empty` is reachable on step 2 alone, and that is the handoff's own rule (B5) rather than
 * a simplification: it is the one step where "nothing written yet" is honest. The columns
 * and every setting exist from the moment the exercise is created, so steps 1 and 3 would
 * be claiming a silence that is not there, and step 4 raises its own blocker instead.
 */
function MultipleChoiceGroupSteps({
  current,
  exercise,
  targetLanguage,
  onSelect,
}: {
  current: IssueStep;
  exercise: MultipleChoiceGroupDocument;
  targetLanguage: string;
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = stepState(exercise, step, { language: targetLanguage });
    const label = t(`multipleChoiceGroup.shell.step${step}` as 'multipleChoiceGroup.shell.step1');
    const sub = t(
      `multipleChoiceGroup.shell.stepSub${step}` as 'multipleChoiceGroup.shell.stepSub1',
    );

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
      label={t('multipleChoiceGroup.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * A filter over `issues` and nothing more — no rule of its own, which is what makes the
 * modal, the rail and the step-level messages incapable of disagreeing. `info` findings are
 * left out: the handoff keeps them inline on step 2, and an observation about a habit on a
 * list of things to fix before assigning would be read as one more chore.
 */
function GateDialog({
  open,
  exercise,
  problems,
  onOpenChange,
  onGoToStep,
}: {
  open: boolean;
  exercise: MultipleChoiceGroupDocument;
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
      passes={usePasses(exercise)}
      onOpenChange={onOpenChange}
      onGoToStep={onGoToStep}
    />
  );
}

/**
 * What this table is about to do to a student, in the author's own numbers.
 *
 * Everything here is restated from what they already wrote, which is the point: they wrote
 * it one step at a time, and this is the only place it is read together. Two lines carry
 * most of it. The spread — how the answers fall across the columns — is the one number that
 * says whether the table can be passed without reading, and the pass mark in rows is the
 * one that says what passing costs: "70%" of five statements is four right, and an author
 * who meant three has set the wrong switch.
 */
function usePasses(exercise: MultipleChoiceGroupDocument): string[] {
  const t = useTranslations('Authoring');

  const ready = readyRows(exercise);
  const spread = balance(exercise);
  const cov = coverage(exercise);

  return [
    ready.length > 0
      ? t('multipleChoiceGroup.gate.statements', {
          count: ready.length,
          columns: exercise.columns.length,
        })
      : null,
    ready.length > 0
      ? t('multipleChoiceGroup.gate.spread', {
          spread: spread.counts
            .map((count) => `${count.column.label.trim() || '—'} ${count.n}`)
            .join(' · '),
        })
      : null,
    ready.length > 0
      ? t('multipleChoiceGroup.gate.passMark', {
          threshold: exercise.settings.passThreshold,
          mark: passMark(exercise.settings, ready.length),
          total: ready.length,
        })
      : null,
    cov.written > 0 ? t('multipleChoiceGroup.gate.explanations', { count: cov.written }) : null,
    cov.quoted > 0 ? t('multipleChoiceGroup.gate.quotes', { count: cov.quoted }) : null,
    exercise.source.mode === 'inline'
      ? t('multipleChoiceGroup.gate.sourceInline')
      : exercise.source.mode === 'link'
        ? t('multipleChoiceGroup.gate.sourceLink')
        : t('multipleChoiceGroup.gate.sourceNone'),
    t(
      `multipleChoiceGroup.gate.retry${
        exercise.settings.retry === 'none'
          ? 'None'
          : exercise.settings.retry === 'one'
            ? 'One'
            : 'Unlimited'
      }` as 'multipleChoiceGroup.gate.retryNone',
    ),
  ].filter((line): line is string => line !== null);
}
