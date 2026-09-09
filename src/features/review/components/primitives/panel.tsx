import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PanelProps {
  title: string;
  /** One line under the title: what the numbers mean, or where they start from. */
  sub?: ReactNode;
  /** A control belonging to this section — an export, a period switch. */
  right?: ReactNode;
  children: ReactNode;
  /** Body padding. Rows that carry their own hover state ask for less of it. */
  bodyClassName?: string;
  className?: string;
}

/**
 * One section of the oversight screen (`COMPONENTS.md` §C/D).
 *
 * The screen is a stack of these and nothing else — no tabs, no accordions. It is opened
 * about once a week, and everything on it has to be readable in one pass: a section behind
 * a tab is a section an administrator does not know exists, and the whole point of this
 * screen is that the load can be seen without going looking for it.
 *
 * The subtitle is where honesty lives. Several of these sections count something that
 * needs a caveat — a horizon the data starts at, a queue counted twice because two people
 * read it — and the caveat belongs in the header beside the figure, not in a footnote.
 */
export function Panel({ title, sub, right, children, bodyClassName, className }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-[14px] border-[1.5px] border-border bg-(--ssz-bg-surface) shadow-xs',
        className,
      )}
    >
      <header className="flex items-end gap-3 border-b-[1.5px] border-border px-5 pb-3 pt-[15px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
          {sub === undefined ? null : (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</div>
          )}
        </div>
        {right}
      </header>
      <div className={cn('px-5 py-[18px]', bodyClassName)}>{children}</div>
    </section>
  );
}
