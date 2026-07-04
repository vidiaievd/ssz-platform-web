import { CheckCircle, Clock, Eye, Pencil, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { AssignmentStatus } from '@/features/learning/types';

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { variant: BadgeProps['variant']; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  active:      { variant: 'primary',  Icon: Clock },
  overdue:     { variant: 'error',    Icon: Clock },
  submitted:   { variant: 'info',     Icon: Upload },
  'in-review': { variant: 'warning',  Icon: Eye },
  returned:    { variant: 'warning',  Icon: Pencil },
  completed:   { variant: 'success',  Icon: CheckCircle },
};

interface AssignmentStatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

export function AssignmentStatusBadge({ status, className }: AssignmentStatusBadgeProps) {
  const t = useTranslations('Assignments.status');
  const { variant, Icon } = STATUS_CONFIG[status];
  const labelKey = status === 'in-review' ? 'inReview' : status as string;

  return (
    <Badge variant={variant} className={className}>
      <Icon size={11} aria-hidden />
      {t(labelKey as Parameters<typeof t>[0])}
    </Badge>
  );
}
