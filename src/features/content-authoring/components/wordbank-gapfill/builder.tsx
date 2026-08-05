'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, CircleAlert, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
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
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { StepSentences } from './step-sentences';
import { StepWordBank } from './step-word-bank';
import { StepFeedback } from './step-feedback';
import { useGapFillAutosave } from './use-gap-fill-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3];

export interface GapFillBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: WordBankGapFill;
  initialInstructions: string;
  initialHint: string;
  /** Module vocabulary offered as distractors in step 2. */
  suggestions?: string[];
  /** Renders the live student preview beside the editor (step 4.6). */
  previewSlot?: (exercise: WordBankGapFill) => React.ReactNode;
}

/**
 * The gap-fill builder: three steps, one document, and the two things that make it a
 * screen rather than three forms — a rail that says where the problems are, and a save
 * the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring is not
 * linear: a gap added in step 1 is a row in step 3, and the teacher will go back.
 *
 * `EX_NO_TITLE` is dropped from every list here. The platform has no title on an
 * exercise — instructions are the required field, enforced on save — and the same code
 * is dropped by container pre-flight for the same reason, so a builder that reported it
 * would be the only place in the product asking for something that cannot be typed.
 */
export function GapFillBuilder({
  exerciseId,
  containerId,
  initialExercise,
  initialInstructions,
  initialHint,
  suggestions = [],
  previewSlot,
}: GapFillBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [hint, setHint] = useState(initialHint);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const dirty =
    exercise !== initialExercise || instructions !== initialInstructions || hint !== initialHint;

  const autosave = useGapFillAutosave({
    exerciseId,
    containerId,
    exercise,
    instructions,
    hint,
    dirty,
    // The token moves on with every save; the next write is compared against this one.
    onSaved: (updatedAt) => setExercise((current) => ({ ...current, updatedAt })),
  });

  const problems = useMemo(
    () => issues(exercise).filter((issue) => issue.code !== 'EX_NO_TITLE'),
    [exercise],
  );
  const blockers = problems.filter((issue) => issue.level === 'blocker');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepRail current={step} problems={problems} onSelect={setStep} />
        <div className="flex items-center gap-3">
          <SaveHint status={autosave.status} savedAt={autosave.savedAt} onRetry={autosave.retry} />
          <Button type="button" onClick={() => setGateOpen(true)}>
            {t('gapFill.shell.done')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1">
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" htmlFor="gapfill-instructions">
                    {t('gapFill.shell.instructionsLabel')}
                  </label>
                  <Input
                    id="gapfill-instructions"
                    value={instructions}
                    hasError={instructions.trim() === ''}
                    aria-invalid={instructions.trim() === ''}
                    placeholder={t('gapFill.shell.instructionsPlaceholder')}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('gapFill.shell.instructionsHelp')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" htmlFor="gapfill-hint">
                    {t('gapFill.shell.hintLabel')}
                  </label>
                  <Textarea
                    id="gapfill-hint"
                    rows={2}
                    value={hint}
                    placeholder={t('gapFill.shell.hintPlaceholder')}
                    onChange={(event) => setHint(event.target.value)}
                  />
                </div>
              </div>

              <StepSentences exercise={exercise} onChange={setExercise} />
            </div>
          )}

          {step === 2 && (
            <StepWordBank
              exercise={exercise}
              onChange={setExercise}
              suggestions={suggestions}
              onEditGaps={() => setStep(1)}
            />
          )}

          {step === 3 && <StepFeedback exercise={exercise} onChange={setExercise} />}
        </div>

        {previewSlot && <div className="xl:w-[430px] xl:shrink-0">{previewSlot(exercise)}</div>}
      </div>

      <GateDialog
        open={gateOpen}
        problems={problems}
        blockerCount={blockers.length}
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
  onSelect: (step: IssueStep) => void;
}

/**
 * Where the problems are, per step. A rail rather than a wizard: any step is reachable,
 * and the badge is a count in words as well as a colour (AC-B26, AC-X7).
 */
function StepRail({ current, problems, onSelect }: StepRailProps) {
  const t = useTranslations('Authoring');

  return (
    <div role="tablist" aria-label={t('gapFill.shell.stepsLabel')} className="flex gap-1">
      {STEPS.map((step) => {
        const own = problems.filter((issue) => issue.step === step);
        const blockers = own.filter((issue) => issue.level === 'blocker').length;
        const warnings = own.length - blockers;
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
            <span>{t(`gapFill.shell.step${step}` as 'gapFill.shell.step1')}</span>
            {blockers > 0 ? (
              <span className="rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
                {t('gapFill.shell.blockerCount', { count: blockers })}
              </span>
            ) : warnings > 0 ? (
              <span className="rounded-full bg-warning-100 px-1.5 text-[11px] font-semibold text-warning-700">
                {t('gapFill.shell.warningCount', { count: warnings })}
              </span>
            ) : (
              <span className="text-[11px] text-success-700">{t('gapFill.shell.stepOk')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useGapFillAutosave>['status'];
  savedAt: Date | null;
  onRetry: () => void;
}

/** `Saving…` → `Saved`, and a way back when it fails. Announced, never colour alone. */
function SaveHint({ status, savedAt, onRetry }: SaveHintProps) {
  const t = useTranslations('Authoring');

  if (status === 'conflict' || status === 'failed') {
    return (
      <span className="flex items-center gap-2 text-xs text-error" role="status">
        <CircleAlert className="size-3.5" aria-hidden />
        {status === 'conflict' ? t('gapFill.shell.saveConflict') : t('gapFill.shell.saveFailed')}
        <Button type="button" variant="link" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          {t('gapFill.shell.saveRetry')}
        </Button>
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('gapFill.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('gapFill.shell.saved', { time: savedAt.toLocaleTimeString() })}
    </span>
  );
}

interface GateDialogProps {
  open: boolean;
  problems: Issue[];
  blockerCount: number;
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: IssueStep) => void;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first. It is a report, not a state change — readiness is decided by container
 * pre-flight from the same rules, so there is nothing here to flip.
 */
function GateDialog({ open, problems, blockerCount, onOpenChange, onGoToStep }: GateDialogProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy();
  const ordered = [
    ...problems.filter((issue) => issue.level === 'blocker'),
    ...problems.filter((issue) => issue.level === 'warning'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('gapFill.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {ordered.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('gapFill.shell.gateClear')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ordered.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <button
                  type="button"
                  onClick={() => onGoToStep(issue.step)}
                  className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-[var(--ssz-bg-subtle)]"
                >
                  {issue.level === 'blocker' ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning-700"
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block">{describeIssue(issue)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('gapFill.shell.gateGoToStep', { step: issue.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('gapFill.step1.cancel')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('gapFill.shell.gateBlocked', { count: blockerCount })
              : t('gapFill.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
