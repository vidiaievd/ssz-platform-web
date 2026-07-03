import { CheckCircle, Circle, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';

export type CanDoState = 'locked' | 'in-progress' | 'unlocked';

export interface CanDoBadgeProps {
  text: string;
  state?: CanDoState;
  className?: string;
}

const STATE_STYLES: Record<CanDoState, { icon: typeof Circle; iconClass: string; ringClass: string }> = {
  locked: {
    icon: Lock,
    iconClass: 'text-(--ssz-text-muted)',
    ringClass: 'border-[var(--ssz-border-default)] bg-[var(--ssz-bg-subtle)]',
  },
  'in-progress': {
    icon: Circle,
    iconClass: 'text-[var(--ssz-color-secondary-500)]',
    ringClass: 'border-[var(--ssz-color-secondary-300)] bg-[var(--ssz-color-secondary-50)]',
  },
  unlocked: {
    icon: CheckCircle,
    iconClass: 'text-[var(--ssz-color-primary-600)]',
    ringClass: 'border-[var(--ssz-color-primary-200)] bg-[var(--ssz-color-primary-50)]',
  },
};

export function CanDoBadge({ text, state = 'locked', className }: CanDoBadgeProps) {
  const { icon: Icon, iconClass, ringClass } = STATE_STYLES[state];

  const stateLabel =
    state === 'unlocked' ? 'Unlocked' : state === 'in-progress' ? 'In progress' : 'Locked';

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border p-3',
        ringClass,
        className,
      )}
      aria-label={`Can do: ${stateLabel} — ${text}`}
    >
      <Icon
        size={16}
        className={cn('mt-0.5 shrink-0', iconClass)}
        aria-hidden="true"
      />
      <p className="text-sm leading-snug text-(--ssz-text-primary)">{text}</p>
    </div>
  );
}
