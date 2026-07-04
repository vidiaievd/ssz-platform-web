import type { LucideIcon } from 'lucide-react';
import { BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = BookOpen,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 py-16 text-center',
        className,
      )}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--ssz-bg-subtle)' }}
        aria-hidden="true"
      >
        <Icon size={24} className="text-(--ssz-text-muted)" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--ssz-text-primary)">{title}</p>
        {description && (
          <p className="mx-auto max-w-xs text-sm text-(--ssz-text-muted)">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
