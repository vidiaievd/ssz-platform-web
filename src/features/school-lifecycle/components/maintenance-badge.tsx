import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import type { MaintenanceStatus } from '../types';

/**
 * "No longer maintained" / "Outdated" mark for a course (plan 90, phase 5, Q5). Nothing for a
 * maintained course or one from a service that predates the field.
 */
export function MaintenanceBadge({ status, className }: { status: MaintenanceStatus | undefined; className?: string }) {
  const t = useTranslations('SchoolLifecycle.maintenance');
  if (!status || status === 'maintained') return null;
  return (
    <Badge variant={status === 'obsolete' ? 'error' : 'warning'} className={className} title={t(`${status}Hint`)}>
      {t(status)}
    </Badge>
  );
}
