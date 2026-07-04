import { cn } from '@/lib/utils';

export type SectionReadinessState = 'ok' | 'warn' | 'error' | 'empty';

export interface SectionReadinessBadgeProps {
  state: SectionReadinessState;
  errorCount?: number;
}

const DOT_CLASSES: Record<SectionReadinessState, string> = {
  ok:    'bg-success-600',
  warn:  'bg-warning-500',
  error: 'bg-destructive',
  empty: 'border border-dashed border-muted-foreground bg-transparent',
};

const SR_LABEL: Record<SectionReadinessState, string> = {
  ok:    'complete',
  warn:  'has warnings',
  error: 'has errors',
  empty: 'empty',
};

export function SectionReadinessBadge({ state, errorCount }: SectionReadinessBadgeProps) {
  if (state === 'error' && errorCount && errorCount > 0) {
    return (
      <span
        className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
        aria-label={`, ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
      >
        {errorCount}
      </span>
    );
  }

  return (
    <>
      <span
        className={cn('ml-1.5 inline-block h-2 w-2 shrink-0 rounded-full', DOT_CLASSES[state])}
        aria-hidden
      />
      <span className="sr-only">, {SR_LABEL[state]}</span>
    </>
  );
}
