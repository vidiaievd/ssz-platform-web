'use client';

// Requires backend support — re-point mutation unconfirmed (spec §6.2, Open Q1).
// Do not enable until the org-service endpoint and side-effect contract are confirmed.
// Renders a disabled trigger only; no PATCH { courseId } call exists yet.

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export function ChangeCourseDialog() {
  const t = useTranslations('Groups');

  return (
    <Button variant="outline" disabled title={t('course.changeComingSoon')}>
      {t('course.change')}
    </Button>
  );
}
