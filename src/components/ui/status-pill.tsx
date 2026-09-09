import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'warning' | 'destructive' | 'success';

type StatusPillProps = {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
};

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  accent: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  destructive: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
};

export function StatusPill({ tone = 'neutral', children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        // py-0.5 + leading-none left descenders (g, p) in words like "Draft"
        // touching the pill's own edge — leading-none is exactly zero space
        // beyond the glyph's own metrics, so there was nothing left to give.
        'inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-semibold leading-[1.1]',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
