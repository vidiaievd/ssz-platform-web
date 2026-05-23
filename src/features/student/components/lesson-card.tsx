import { Check, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import type { LessonStatus } from '@/components/ui/badge';

interface LessonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lessonNumber: number;
  title: string;
  description?: string;
  duration?: string;
  status: LessonStatus;
  onStart?: () => void;
}

const numberStyle: Record<LessonStatus, string> = {
  done:   'bg-success-100 text-success-700',
  active: 'bg-primary-100 text-primary-700',
  new:    'bg-neutral-100 text-neutral-500',
  locked: 'bg-neutral-100 text-neutral-400',
};

export function LessonCard({
  className,
  lessonNumber,
  title,
  description,
  duration,
  status,
  onStart,
  ...props
}: LessonCardProps) {
  const isActive = status === 'active';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl p-4',
        'bg-[var(--ssz-bg-surface)] border transition-all duration-base ease-out-ssz',
        'hover:bg-[var(--ssz-bg-subtle)]',
        isActive
          ? 'border-primary-200 shadow-sm'
          : 'border-transparent hover:border-border',
        status === 'locked' && 'opacity-60 pointer-events-none',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'size-9 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold',
          numberStyle[status],
        )}
      >
        {status === 'done' ? (
          <Check className="size-4" strokeWidth={2.5} />
        ) : (
          lessonNumber
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--ssz-text-primary)] truncate">{title}</p>
        {(description || duration) && (
          <p className="text-xs text-[var(--ssz-text-secondary)] mt-0.5">
            {[description, duration].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={status} />
        {isActive && (
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onStart?.();
            }}
          >
            <Play className="size-3.5" />
            Start
          </Button>
        )}
      </div>
    </div>
  );
}
