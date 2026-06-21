import Link from 'next/link';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';
import { AlertChip } from '@/components/shared/operations';
import type { Alert } from '@/features/dashboard/types';

type Props = {
  alerts: Alert[];
  groupId: string;
  schoolSlug: string;
  canManage: boolean;
};

function fixHref(alert: Alert, groupId: string, schoolSlug: string): string {
  const base = `/school/${schoolSlug}/groups/${groupId}`;
  switch (alert.type) {
    case 'no-primary':
      return `${base}/assign-teacher?role=primary`;
    case 'conflict':
    case 'overload':
      return `${base}/assign-teacher`;
    case 'over':
    case 'under':
      return `${base}/add-students`;
  }
}

export async function GroupResolveBanner({ alerts, groupId, schoolSlug, canManage }: Props) {
  if (!alerts.length) return null;
  const t = await getTranslations('Groups');
  const hasDanger = alerts.some((a) => a.severity === 'danger');

  return (
    <div
      role="alert"
      aria-label={hasDanger ? t('resolve.actionRequired') : t('resolve.attentionNeeded')}
      className={cn(
        'rounded-lg border px-4 py-3 flex flex-col gap-2',
        hasDanger
          ? 'border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20'
          : 'border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20',
      )}
    >
      <div className="flex items-center gap-2">
        {hasDanger ? (
          <AlertCircle className="size-4 text-error-600 dark:text-error-400 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-4 text-warning-600 dark:text-warning-400 shrink-0" aria-hidden="true" />
        )}
        <span className={cn(
          'text-sm font-semibold',
          hasDanger ? 'text-error-700 dark:text-error-300' : 'text-warning-700 dark:text-warning-300',
        )}>
          {hasDanger ? t('resolve.actionRequired') : t('resolve.attentionNeeded')}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5" aria-label={t('resolve.issuesLabel')}>
        {alerts.map((alert, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertChip alert={alert} />
              <span className="text-xs text-(--ssz-text-secondary) truncate">{alert.label}</span>
            </div>
            {canManage && (
              <Link
                href={fixHref(alert, groupId, schoolSlug)}
                className={cn(
                  'text-xs font-semibold shrink-0 underline-offset-2 hover:underline',
                  alert.severity === 'danger'
                    ? 'text-error-700 dark:text-error-400'
                    : 'text-warning-700 dark:text-warning-400',
                )}
              >
                {t('resolve.fix')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
