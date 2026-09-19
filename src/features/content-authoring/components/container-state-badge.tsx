import { Badge } from '@/components/ui/badge';
import type { ContainerState } from '../types';

const STATE_CONFIG: Record<
  ContainerState,
  { label: string; variant: 'warning' | 'success' | 'muted' }
> = {
  draft: { label: 'Draft', variant: 'warning' },
  published: { label: 'Published', variant: 'success' },
  archived: { label: 'Archived', variant: 'muted' },
};

interface ContainerStateBadgeProps {
  state: ContainerState;
  className?: string;
  /** A 6px dot before the label, so the state survives greyscale and colour blindness. */
  dot?: boolean;
  /** Appended after a middle dot — the live version number, where there is one. */
  suffix?: string;
}

export function ContainerStateBadge({ state, className, dot, suffix }: ContainerStateBadgeProps) {
  const { label, variant } = STATE_CONFIG[state];
  return (
    <Badge
      variant={variant}
      className={className}
      aria-label={suffix ? `Status: ${label} — ${suffix}` : `Status: ${label}`}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {label}
      {suffix && (
        <span aria-hidden className="font-normal opacity-80">
          · {suffix}
        </span>
      )}
    </Badge>
  );
}

/** Derives ContainerState from the Container's lifecycle fields. */
export function deriveContainerState(container: {
  currentPublishedVersionId?: string | null;
  isArchived?: boolean;
}): ContainerState {
  if (container.isArchived) return 'archived';
  return container.currentPublishedVersionId ? 'published' : 'draft';
}
