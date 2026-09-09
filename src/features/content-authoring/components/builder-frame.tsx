'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The chrome every document builder wears around its steps: the save hint, the way
 * forward at the foot of a step, and the pre-assign gate.
 *
 * `builder-step-rail.tsx` took the rail out of four near-identical copies for the reason
 * that applies here to the other three pieces — the builders differ in how they *work out*
 * what is wrong with a document, which is their business, and in nothing about how the
 * chrome around that answer is drawn. Plan 34 §10 asks the fifth builder to take a common
 * frame rather than copy a fourth one; this is that frame.
 *
 * The four builders that predate it are deliberately left alone. Their copy has drifted
 * apart on purpose (match-pairs rewords the gate), and rewriting four working builders to
 * share a component is a change with nothing to show for it and four things to break. New
 * builders start here.
 *
 * Copy lives in one `Authoring.builder` namespace rather than arriving as props: these
 * strings say the same thing whatever document is being authored, and a frame that took
 * a dozen labels from its caller would have moved the duplication rather than removed it.
 */

export type BuilderSaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'rejected' | 'conflict';

export interface BuilderSaveHintProps {
  status: BuilderSaveStatus;
  savedAt: Date | null;
}

/**
 * `Saving…` → `Saved`, announced politely, and nothing else.
 *
 * What a failed save needs is said elsewhere (`builder-save-notices.tsx`): this line
 * shares one strip with a step rail, so it has room for a status and none for an
 * explanation — a sentence here is a sentence that squeezes the rail off the screen.
 */
export function BuilderSaveHint({ status, savedAt }: BuilderSaveHintProps) {
  const t = useTranslations('Authoring.builder');

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('saving')}
      {status === 'saved' && savedAt !== null && t('saved', { time: savedAt.toLocaleTimeString() })}
    </span>
  );
}

export interface BuilderStepNavProps {
  current: number;
  /** The last step's number — where `Next` stops and the gate takes over. */
  last: number;
  /** What the next step is called, for the `Next: …` label. */
  stepLabel: (step: number) => string;
  onSelect: (step: number) => void;
  onDone: () => void;
}

/**
 * The way forward at the bottom of a step. The rail above stays the map — this is the
 * default path through it. Nothing here validates: steps are reachable in any order, and
 * the gate is the only place that reports problems.
 */
export function BuilderStepNav({
  current,
  last,
  stepLabel,
  onSelect,
  onDone,
}: BuilderStepNavProps) {
  const t = useTranslations('Authoring.builder');

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        disabled={current <= 1}
        onClick={() => onSelect(current - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('navBack')}
      </Button>

      {current >= last ? (
        <Button type="button" onClick={onDone}>
          {t('done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect(current + 1)}>
          {t('navNext', { step: stepLabel(current + 1) })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** One thing standing between the document and a student, and where it is fixed. */
export interface GateRow {
  key: string;
  level: 'blocker' | 'warning';
  text: string;
  step: number;
}

export interface BuilderGateDialogProps {
  open: boolean;
  /** Blockers first, then warnings — the caller decides what belongs on the list. */
  rows: GateRow[];
  /**
   * What the document already says, in the author's own settings — the counts, the range,
   * who marks it. Optional: a builder with nothing worth restating passes nothing.
   */
  passes?: string[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first, each row a way to the step that fixes it.
 *
 * A report, not a state change — readiness is decided by container pre-flight from the
 * same rules, so there is nothing here to flip. The blocker count is derived from `rows`
 * rather than taken as a prop, so the number on the button cannot disagree with the list
 * above it.
 *
 * The green summary underneath answers the question the red and amber lists cannot: what
 * is this exercise, as configured, about to do to a student. An author who fixed the last
 * blocker is one click from assigning, and this is the only moment where the word range,
 * the pass mark and "a person reads every answer" are stated together.
 */
export function BuilderGateDialog({
  open,
  rows,
  passes = [],
  onOpenChange,
  onGoToStep,
}: BuilderGateDialogProps) {
  const t = useTranslations('Authoring.builder');
  const blockerCount = rows.filter((row) => row.level === 'blocker').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('gateTitle')}</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('gateClear')}
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
                      {t('gateGoToStep', { step: row.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {passes.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-border pt-3">
            {passes.map((pass) => (
              <li key={pass} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success-700" aria-hidden />
                <span>{pass}</span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('gateClose')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0 ? t('gateBlocked', { count: blockerCount }) : t('gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
