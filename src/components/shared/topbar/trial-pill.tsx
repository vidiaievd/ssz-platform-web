'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

// TODO(billing): replace with real data from billing-service
// GET /api/schools/{id}/billing/summary → { plan, trialEndsAt, status }
const TRIAL_DAYS_REMAINING = 28;

export function TrialPill() {
  const t = useTranslations('Topbar.trial');

  return (
    <Badge variant="warning" className="hidden sm:flex font-medium shrink-0">
      {t('daysLeft', { days: TRIAL_DAYS_REMAINING })}
    </Badge>
  );
}
