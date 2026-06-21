'use client';

import { useTranslations } from 'next-intl';

import { HealthDot } from '@/components/shared/operations';
import type { Alert } from '@/features/dashboard/types';
import type { GroupStatus } from '../types';

type Props = {
  alerts: Alert[];
  status: GroupStatus;
  /** Set when health could not be computed (e.g. conflict data unavailable). */
  degraded?: boolean;
};

export function GroupHealthLine({ alerts, status, degraded = false }: Props) {
  const t = useTranslations('Groups');
  const statusLabel =
    status === 'active'
      ? t('status.active')
      : status === 'archived'
        ? t('status.archived')
        : t('status.draft');

  if (degraded) {
    return (
      <p aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-warning-700 dark:text-warning-400">
        <HealthDot state="warn" />
        <span>
          {t('overview.statusUnknown')}
          <span className="sr-only"> · {statusLabel}</span>
        </span>
      </p>
    );
  }

  const notReady = alerts.some((a) => a.severity === 'danger');

  return (
    <p
      aria-live="polite"
      className={
        notReady
          ? 'flex items-center gap-2 text-sm font-medium text-error-700 dark:text-error-400'
          : 'flex items-center gap-2 text-sm font-medium text-success-700 dark:text-success-400'
      }
    >
      <HealthDot state={notReady ? 'danger' : 'ok'} />
      <span>
        {notReady ? (
          <>
            {t('overview.notReady')}
            <span className="sr-only"> — {alerts.find((a) => a.severity === 'danger')?.label}</span>
          </>
        ) : (
          t('overview.ready')
        )}
        {' · '}
        {statusLabel}
      </span>
    </p>
  );
}
