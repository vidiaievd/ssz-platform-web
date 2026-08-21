'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  issues,
  type Issue,
  type IssueStep,
  type MatchPairs,
  type Variant,
} from '@/lib/shared-kernel/match-pairs';

import { EditorToolbarPortal } from '../editor-toolbar';
import { StepPairs } from './step-pairs';
import { StepRightColumn } from './step-right-column';
import { StepFeedback } from './step-feedback';
import { useMatchPairsAutosave, type SavedDocument } from './use-match-pairs-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3];

export interface MatchPairsBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: MatchPairs;
  initialInstructions: string;
  /**
   * Whether the stored content named a variant, or is only being read as `pairs` because
   * the field was absent. Computed from the raw column by `hasExplicitVariant`, because
   * the parsed document can no longer tell the two apart.
   */
  initialVariantChosen: boolean;
  onDocumentChange?: (exercise: MatchPairs, instructions: string) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The match-pairs builder: three steps, one document, a rail that says where the problems
 * are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring is not
 * linear: a pair added in step 1 is a row in step 3 and a chip in step 2, and the teacher
 * will go back.
 *
 * `EX_NO_TITLE` is dropped from every list here, as in the three builders before it: the
 * platform has no title on an exercise — instructions are the required field, enforced on
 * save — and container pre-flight drops the same code for the same reason.
 */
export function MatchPairsBuilder({
  exerciseId,
  containerId,
  initialExercise,
  initialInstructions,
  initialVariantChosen,
  onDocumentChange,
  onSavedRemote,
}: MatchPairsBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [variantChosen, setVariantChosen] = useState(initialVariantChosen);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useMatchPairsAutosave({
    exerciseId,
    containerId,
    exercise,
    instructions,
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
    reportRef.current?.(exercise, instructions);
  }, [exercise, instructions]);

  const problems = useMemo(
    () => issues(exercise).filter((issue) => issue.code !== 'EX_NO_TITLE'),
    [exercise],
  );
  /**
   * The one blocker the kernel cannot report. `Variant` has no "unchosen" value and an
   * absent field parses as `pairs`, so "the author never chose" exists only here — and
   * only until the gate is passed once (plan 49, phase 4).
   */
  const blockerCount =
    problems.filter((issue) => issue.level === 'blocker').length + (variantChosen ? 0 : 1);

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <StepRail
            current={step}
            problems={problems}
            variantChosen={variantChosen}
            onSelect={setStep}
          />
          <div className="flex items-center gap-3">
            <SaveHint
              status={autosave.status}
              savedAt={autosave.savedAt}
              canOverwrite={autosave.canOverwrite}
              onRetry={autosave.retry}
              onOverwrite={autosave.overwrite}
            />
            <Button type="button" onClick={() => setGateOpen(true)}>
              {t('matchPairs.shell.done')}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
              <label className="text-xs font-medium" htmlFor="match-pairs-instructions">
                {t('matchPairs.shell.instructionsLabel')}
              </label>
              <Input
                id="match-pairs-instructions"
                value={instructions}
                hasError={instructions.trim() === ''}
                aria-invalid={instructions.trim() === ''}
                placeholder={t('matchPairs.shell.instructionsPlaceholder')}
                onChange={(event) => setInstructions(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('matchPairs.shell.instructionsHelp')}
              </p>
            </div>

            <StepPairs
              exercise={exercise}
              onChange={setExercise}
              variantChosen={variantChosen}
              onVariantChosen={(variant: Variant) => {
                setVariantChosen(true);
                setExercise((current) => ({ ...current, variant }));
              }}
            />
          </div>
        )}

        {step === 2 && (
          <StepRightColumn
            exercise={exercise}
            onChange={setExercise}
            onEditPairs={() => setStep(1)}
          />
        )}

        {step === 3 && <StepFeedback exercise={exercise} onChange={setExercise} />}

        <StepNav current={step} onSelect={setStep} onDone={() => setGateOpen(true)} />
      </div>

      <GateDialog
        open={gateOpen}
        problems={problems}
        variantChosen={variantChosen}
        blockerCount={blockerCount}
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target);
          setGateOpen(false);
        }}
      />
    </div>
  );
}

interface StepRailProps {
  current: IssueStep;
  problems: Issue[];
  variantChosen: boolean;
  onSelect: (step: IssueStep) => void;
}

/**
 * Where the problems are, per step. A rail rather than a wizard: any step is reachable,
 * and the badge is a count in words as well as a colour (AC-B27, AC-X7).
 */
function StepRail({ current, problems, variantChosen, onSelect }: StepRailProps) {
  const t = useTranslations('Authoring');

  return (
    <div role="tablist" aria-label={t('matchPairs.shell.stepsLabel')} className="flex gap-1">
      {STEPS.map((step) => {
        const own = problems.filter((issue) => issue.step === step);
        const blockers =
          own.filter((issue) => issue.level === 'blocker').length +
          (step === 1 && !variantChosen ? 1 : 0);
        const warnings = own.length - own.filter((issue) => issue.level === 'blocker').length;
        const isActive = step === current;

        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(step)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-border text-[var(--ssz-text-secondary)] hover:bg-[var(--ssz-bg-subtle)]'
            }`}
          >
            <span className="font-semibold">{step}</span>
            <span>{t(`matchPairs.shell.step${step}` as 'matchPairs.shell.step1')}</span>
            {blockers > 0 ? (
              <span className="rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
                {t('matchPairs.shell.blockerCount', { count: blockers })}
              </span>
            ) : warnings > 0 ? (
              <span className="rounded-full bg-warning-100 px-1.5 text-[11px] font-semibold text-warning-700">
                {t('matchPairs.shell.warningCount', { count: warnings })}
              </span>
            ) : (
              <span className="text-[11px] text-success-700">{t('matchPairs.shell.stepOk')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface StepNavProps {
  current: IssueStep;
  onSelect: (step: IssueStep) => void;
  onDone: () => void;
}

/**
 * The way forward at the bottom of a step. The rail above stays the map — this is the
 * default path through it. Nothing here validates: steps are reachable in any order, and
 * the gate is the only place that reports problems.
 */
function StepNav({ current, onSelect, onDone }: StepNavProps) {
  const t = useTranslations('Authoring');
  const previous = (current - 1) as IssueStep;
  const next = (current + 1) as IssueStep;

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        disabled={current === 1}
        onClick={() => onSelect(previous)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('matchPairs.shell.navBack')}
      </Button>

      {current === 3 ? (
        <Button type="button" onClick={onDone}>
          {t('matchPairs.shell.done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect(next)}>
          {t('matchPairs.shell.navNext', {
            step: t(`matchPairs.shell.step${next}` as 'matchPairs.shell.step1'),
          })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useMatchPairsAutosave>['status'];
  savedAt: Date | null;
  canOverwrite: boolean;
  onRetry: () => void;
  onOverwrite: () => void;
}

/**
 * `Saving…` → `Saved`, and a way back when it fails (AC-B23, AC-B24). Announced, never
 * colour alone.
 *
 * A conflict gets its own way out. Autosave stops there by design, so without one the
 * teacher is left with a screen full of work and nothing that will write it.
 */
function SaveHint({ status, savedAt, canOverwrite, onRetry, onOverwrite }: SaveHintProps) {
  const t = useTranslations('Authoring');

  if (status === 'conflict' || status === 'failed') {
    return (
      <span className="flex items-center gap-2 text-xs text-error" role="status">
        <CircleAlert className="size-3.5" aria-hidden />
        {status === 'conflict'
          ? t('matchPairs.shell.saveConflict')
          : t('matchPairs.shell.saveFailed')}
        {status === 'conflict' && canOverwrite ? (
          <Button type="button" variant="link" size="sm" onClick={onOverwrite}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('matchPairs.shell.saveOverwrite')}
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('matchPairs.shell.saveRetry')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('matchPairs.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('matchPairs.shell.saved', { time: savedAt.toLocaleTimeString() })}
    </span>
  );
}

interface GateDialogProps {
  open: boolean;
  problems: Issue[];
  variantChosen: boolean;
  blockerCount: number;
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: IssueStep) => void;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first, each row a way to the step that fixes it (AC-B25, AC-B26).
 *
 * A report, not a state change — readiness is decided by container pre-flight from the
 * same rules, so there is nothing here to flip.
 */
function GateDialog({
  open,
  problems,
  variantChosen,
  blockerCount,
  onOpenChange,
  onGoToStep,
}: GateDialogProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy();

  const rows: { key: string; level: 'blocker' | 'warning'; text: string; step: IssueStep }[] = [
    ...(variantChosen
      ? []
      : [
          {
            key: 'variant',
            level: 'blocker' as const,
            text: t('matchPairs.shell.gateVariant'),
            step: 1 as IssueStep,
          },
        ]),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('matchPairs.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('matchPairs.shell.gateClear')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onGoToStep(row.step)}
                  className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-[var(--ssz-bg-subtle)]"
                >
                  {row.level === 'blocker' ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning-700"
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block">{row.text}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('matchPairs.shell.gateGoToStep', { step: row.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('matchPairs.step1.cancel')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('matchPairs.shell.gateBlocked', { count: blockerCount })
              : t('matchPairs.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
