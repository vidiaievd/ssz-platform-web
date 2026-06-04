import { StatusPill } from '@/components/ui/status-pill';
import type { GroupStatus } from '../types';

type Tone = 'neutral' | 'success' | 'warning';

const STATUS_CONFIG: Record<GroupStatus, { tone: Tone; label: string }> = {
  draft:    { tone: 'neutral', label: 'Draft' },
  active:   { tone: 'success', label: 'Active' },
  archived: { tone: 'warning', label: 'Archived' },
};

type Props = { status: GroupStatus; className?: string };

export function GroupStatusPill({ status, className }: Props) {
  const { tone, label } = STATUS_CONFIG[status];
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  );
}
