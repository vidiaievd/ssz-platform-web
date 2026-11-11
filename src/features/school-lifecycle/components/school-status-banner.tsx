'use client';

import { Archive, PauseCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';

import { daysLeft } from '../lib/days-left';
import type { SchoolLifecycleStatus } from '../types';

export interface SchoolStatusBannerProps {
  status: SchoolLifecycleStatus | undefined;
  closesAt?: string | null;
  purgeAt?: string | null;
  /** `staff` — owner, teachers, admins; `student` — a learner of the school. */
  audience: 'staff' | 'student';
  className?: string;
}

/**
 * Says why a school's screens are read only (plan 90, phase 5). Draws nothing for an
 * `active` school or one whose status the service did not send — an older service must
 * not make every school look blocked.
 */
export function SchoolStatusBanner({ status, closesAt, purgeAt, audience, className }: SchoolStatusBannerProps) {
  const t = useTranslations('SchoolLifecycle.banner');
  const locale = useLocale() as Locale;

  if (!status || status === 'active') return null;

  const closed = status === 'closed' || status === 'purged';
  const until = closed ? purgeAt : closesAt;
  const date = until && !Number.isNaN(Date.parse(until)) ? formatDate(new Date(until), locale) : null;
  const left = daysLeft(until);
  const key = `${audience}.${closed ? 'closed' : 'suspended'}${date ? 'Until' : ''}` as const;

  return (
    <Alert
      variant={closed ? 'error' : 'warning'}
      icon={closed ? <Archive className="h-4 w-4" aria-hidden /> : <PauseCircle className="h-4 w-4" aria-hidden />}
      title={t(`${audience}.${closed ? 'closedTitle' : 'suspendedTitle'}`)}
      className={className}
      data-testid="school-status-banner"
      data-status={status}
    >
      {t(key, { date: date ?? '', days: left ?? 0 })}
    </Alert>
  );
}
