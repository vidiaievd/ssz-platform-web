import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type WidgetEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  cta?: React.ReactNode;
  className?: string;
};

export function WidgetEmptyState({
  icon: Icon,
  title,
  body,
  cta,
  className,
}: WidgetEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border py-8 px-4 text-center',
        className,
      )}
    >
      {Icon && (
        <Icon
          className="size-8 text-(--ssz-text-muted) opacity-60"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-(--ssz-text-secondary)">{title}</p>
        {body && <p className="text-xs text-(--ssz-text-muted)">{body}</p>}
      </div>
      {cta && <div>{cta}</div>}
    </div>
  );
}
