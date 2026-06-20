import { Badge } from '@/components/ui/badge';
import type { ContainerState } from '../types';

const STATE_CONFIG: Record<
  ContainerState,
  { label: string; variant: 'warning' | 'success' | 'muted' }
> = {
  draft:     { label: 'Draft',     variant: 'warning' },
  published: { label: 'Published', variant: 'success'  },
  archived:  { label: 'Archived',  variant: 'muted'    },
};

interface ContainerStateBadgeProps {
  state: ContainerState;
  className?: string;
}

export function ContainerStateBadge({ state, className }: ContainerStateBadgeProps) {
  const { label, variant } = STATE_CONFIG[state];
  return (
    <Badge variant={variant} className={className} aria-label={`Status: ${label}`}>
      {label}
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
