import { cn } from '@/lib/utils';

type Props = {
  /** Small uppercase label naming the number below it. */
  overline: string;
  value: string;
  caption?: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * One summary card of the schedule tab: what is being counted, the number, and
 * whatever detail belongs under it. Shared by all three so the row reads as one
 * instrument rather than three cards that happen to sit together.
 */
export function ScheduleStat({ overline, value, caption, className, children }: Props) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-5', className)}>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-(--ssz-text-muted)">
        {overline}
      </p>
      <p className="mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.02em] text-(--ssz-text-primary) tabular-nums">
        {value}
      </p>
      {caption && <p className="mt-0.5 text-xs text-(--ssz-text-muted)">{caption}</p>}
      {children}
    </section>
  );
}
