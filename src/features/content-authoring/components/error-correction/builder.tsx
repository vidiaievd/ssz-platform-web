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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  issues,
  stepState,
  type ErrorCorrection,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/error-correction';

import { EditorToolbarPortal } from '../editor-toolbar';
import { StepFormat } from './step-format';
import { StepMistakes } from './step-mistakes';
import { StepCheck } from './step-check';
import { StepFlow } from './step-flow';
import { useErrorCorrectionAutosave } from './use-error-correction-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * The AI stage is stored but has no controls (plan 41, "Отложено"). Reporting a problem
 * with a switch that is nowhere on screen would leave the author with a warning they
 * cannot act on, so these are dropped here — the same treatment gap-fill gives
 * `EX_NO_TITLE`. Building the AI block means deleting this list.
 */
const UNBUILT_CODES = new Set<Issue['code']>(['AI_WITHOUT_CHECK', 'AI_UNLIMITED_BEFORE_SUBMIT']);

export interface ErrorCorrectionBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: ErrorCorrection;
  /**
   * Reports every edit so the shell's preview column can render the student's view of
   * the document being written.
   */
  onDocumentChange?: (exercise: ErrorCorrection) => void;
  /**
   * Every successful save, with the token the row now carries. The shell uses it to keep
   * its cached copy of the exercise current: a cache holding a superseded token is a
   * conflict the next time this builder mounts from it.
   */
  onSavedRemote?: (updatedAt: string, saved: ErrorCorrection) => void;
}

/**
 * The error-correction builder: four steps over one document (BEHAVIOR §A).
 *
 * The rail is not a wizard. Every step is reachable at any time because authoring is not
 * linear — the mistakes written in step 2 are what the settings in step 3 are read
 * against, and the author will go back and forth between them. What the rail carries
 * instead of a lock is the kernel's `stepState`: which step has a blocker, which has
 * something worth a second look, and which is simply empty.
 *
 * Instructions live in the document rather than beside it, because `issues()` reads them
 * to decide whether step 1 is done.
 */
export function ErrorCorrectionBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: ErrorCorrectionBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useErrorCorrectionAutosave({
    exerciseId,
    containerId,
    exercise,
    // The token moves on with every save; the next write is compared against this one.
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
    () => issues(exercise).filter((issue) => !UNBUILT_CODES.has(issue.code)),
    [exercise],
  );
  const blockers = problems.filter((issue) => issue.level === 'blocker');

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <StepRail current={step} exercise={exercise} onSelect={setStep} />
          <div className="flex items-center gap-3">
            <SaveHint
              status={autosave.status}
              savedAt={autosave.savedAt}
              canOverwrite={autosave.canOverwrite}
              onRetry={autosave.retry}
              onOverwrite={autosave.overwrite}
            />
            <Button type="button" onClick={() => setGateOpen(true)}>
              {t('errorCorrection.shell.done')}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 ? (
          <StepFormat exercise={exercise} onChange={setExercise} />
        ) : step === 2 ? (
          <StepMistakes exercise={exercise} onChange={setExercise} />
        ) : step === 3 ? (
          <StepCheck exercise={exercise} onChange={setExercise} />
        ) : (
          <StepFlow exercise={exercise} onChange={setExercise} />
        )}

        <StepNav current={step} onSelect={setStep} onDone={() => setGateOpen(true)} />
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
  exercise: ErrorCorrection;
  onSelect: (step: IssueStep) => void;
}

/**
 * Where the problems are, per step. The dot comes from the kernel's `stepState`, so the
 * rail, the gate and the server cannot disagree about what is wrong — and `info` issues
 * deliberately leave it green, because a dot that turns amber for a remark teaches the
 * author to stop reading it.
 *
 * Colour is never the only signal: each state also says what it is, in words.
 */
function StepRail({ current, exercise, onSelect }: StepRailProps) {
  const t = useTranslations('Authoring');

  return (
    <div role="tablist" aria-label={t('errorCorrection.shell.stepsLabel')} className="flex gap-1">
      {STEPS.map((step) => {
        const { state, blockers } = stepState(exercise, step);
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
            <span>{t(`errorCorrection.shell.step${step}` as 'errorCorrection.shell.step1')}</span>
            {state === 'err' ? (
              <span className="rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
                {t('errorCorrection.shell.blockerCount', { count: blockers })}
              </span>
            ) : state === 'warn' ? (
              <span className="rounded-full bg-warning-100 px-1.5 text-[11px] font-semibold text-warning-700">
                {t('errorCorrection.shell.stepCheck')}
              </span>
            ) : state === 'empty' ? (
              <span className="text-[11px] text-muted-foreground">
                {t('errorCorrection.shell.stepEmpty')}
              </span>
            ) : (
              <span className="text-[11px] text-success-700">
                {t('errorCorrection.shell.stepOk')}
              </span>
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
 * The way forward at the bottom of a step, so an author who has just finished the last
 * sentence does not travel back up to the rail to carry on. Nothing here validates:
 * steps are reachable in any order, and the gate is the only place that reports problems.
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
        {t('errorCorrection.shell.navBack')}
      </Button>

      {current === 4 ? (
        <Button type="button" onClick={onDone}>
          {t('errorCorrection.shell.done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect(next)}>
          {t('errorCorrection.shell.navNext', {
            step: t(`errorCorrection.shell.step${next}` as 'errorCorrection.shell.step1'),
          })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useErrorCorrectionAutosave>['status'];
  savedAt: Date | null;
  canOverwrite: boolean;
  onRetry: () => void;
  onOverwrite: () => void;
}

/**
 * `Saving…` → `Saved`, and a way back when it fails. Announced, never colour alone.
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
          ? t('errorCorrection.shell.saveConflict')
          : t('errorCorrection.shell.saveFailed')}
        {status === 'conflict' && canOverwrite ? (
          <Button type="button" variant="link" size="sm" onClick={onOverwrite}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('errorCorrection.shell.saveOverwrite')}
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('errorCorrection.shell.saveRetry')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('errorCorrection.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('errorCorrection.shell.saved', { time: savedAt.toLocaleTimeString() })}
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
 * first, then what is worth a second look, then the remarks. It is a report, not a state
 * change — readiness is decided by container pre-flight from the same rules — but the
 * button stays disabled while a blocker is listed, which is what the handoff asks of it.
 */
function GateDialog({ open, problems, blockerCount, onOpenChange, onGoToStep }: GateDialogProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy();
  const ordered = [
    ...problems.filter((issue) => issue.level === 'blocker'),
    ...problems.filter((issue) => issue.level === 'warning'),
    ...problems.filter((issue) => issue.level === 'info'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('errorCorrection.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {ordered.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('errorCorrection.shell.gateClear')}
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
                  ) : issue.level === 'warning' ? (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning-700"
                      aria-hidden
                    />
                  ) : (
                    <CircleAlert
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block">{describeIssue(issue)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('errorCorrection.shell.gateGoToStep', { step: issue.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('errorCorrection.shell.gateClose')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('errorCorrection.shell.gateBlocked', { count: blockerCount })
              : t('errorCorrection.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
