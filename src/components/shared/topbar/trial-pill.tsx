'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { useTrialDaysLeft } from '@/features/entitlements';

/**
 * "Trial · N days left" for the workspace's trial subscription, from the rights the layout
 * read (`/subscriptions/me`). Draws nothing off a trial — the free plan and a paid one
 * have nothing to count down.
 */
export function TrialPill() {
  const t = useTranslations('Topbar.trial');
  const days = useTrialDaysLeft();
  if (days === null) return null;

  return (
    <Badge variant="warning" className="hidden sm:flex font-medium shrink-0">
      {t('daysLeft', { days })}
    </Badge>
  );
}
