import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface HSectionProps {
  icon?: LucideIcon;
  title: string;
  sub?: string;
  /** Typically a <TextLink>, e.g. "View all →". */
  action?: React.ReactNode;
  className?: string;
}

/** Section header used across home, my-courses, training and reviews screens. */
export function HSection({ icon: Icon, title, sub, action, className }: HSectionProps) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <Icon size={19} className="shrink-0 text-(--ssz-text-secondary)" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold leading-tight tracking-[-0.015em] text-(--ssz-text-primary)">
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-(--ssz-text-muted)">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
