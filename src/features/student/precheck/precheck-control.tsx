'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { mayAskAgain } from './capability';
import { PrecheckPanel, type PrecheckPanelProps } from './precheck-panel';
import type { PrecheckRun } from './use-precheck-run';

export interface PrecheckButtonProps {
  run: PrecheckRun;
  /** The draft as a submission would carry it; null while there is nothing to read. */
  draft: unknown;
  disabled?: boolean;
  /** Called with the result when a check comes back — the solver reads `selfCheck` from it. */
  onResult?: (result: NonNullable<PrecheckRun['result']>) => void;
}

/**
 * The secondary button that asks for a check. The count of checks left is the panel's to say;
 * the button only goes dim when none are, and goes away when the school or the plan said no.
 */
export function PrecheckButton({ run, draft, disabled = false, onResult }: PrecheckButtonProps) {
  const t = useTranslations('ExerciseRunner.precheck');
  if (run.closed) return null;
  const off = disabled || run.busy || draft === null || !mayAskAgain(run.result?.remaining ?? null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={off}
        onClick={() => {
          void run.run(draft).then((result) => {
            if (result !== null) onResult?.(result);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-(--ssz-text-accent) bg-transparent px-4 py-2 text-[14px] font-bold text-(--ssz-text-accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) disabled:opacity-50"
      >
        {run.busy ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles aria-hidden className="h-4 w-4" />
        )}
        {t('button')}
      </button>
      {run.error !== null && (
        <span role="status" className="text-[12.5px] text-(--ssz-feedback-no-fg)">
          {run.error}
        </span>
      )}
    </span>
  );
}

/** The panel under the work, once a check has come back. */
export function PrecheckResultPanel({
  run,
  ...rest
}: { run: PrecheckRun } & Omit<PrecheckPanelProps, 'result'>) {
  if (run.closed || run.result === null) return null;
  return <PrecheckPanel result={run.result} {...rest} />;
}
