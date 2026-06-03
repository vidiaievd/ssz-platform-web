import { StatusPill } from './status-pill';
import type { DashboardRole } from '@/features/dashboard/types';

type RolePillProps = {
  role: DashboardRole | string;
  className?: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  teacher: 'Teacher',
  editor: 'Editor',
};

const ROLE_TONES = {
  owner: 'warning',
  admin: 'accent',
  teacher: 'neutral',
  editor: 'neutral',
} as const;

export function RolePill({ role, className }: RolePillProps) {
  const tone = (ROLE_TONES as Record<string, 'warning' | 'accent' | 'neutral'>)[role] ?? 'neutral';
  const label = ROLE_LABELS[role] ?? role;
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  );
}
