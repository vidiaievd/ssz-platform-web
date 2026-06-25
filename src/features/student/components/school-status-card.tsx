'use client';

import { useTranslations } from 'next-intl';

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StudentSchool } from '../types';
import { EnrollmentStepper } from './enrollment-stepper';

interface SchoolStatusCardProps {
  school: StudentSchool;
}

/**
 * One row of the "My schools" band for a membership that isn't fully active
 * yet, or that ended (rejected/left) — the stepper for in-progress statuses,
 * a plain status message for terminal ones. Active memberships with their
 * full group/schedule summary are a separate, richer card (Phase D2).
 */
export function SchoolStatusCard({ school }: SchoolStatusCardProps) {
  const t = useTranslations('Student.SchoolStatus');

  const copy = (() => {
    switch (school.status) {
      case 'pending':
        return { title: t('pendingTitle'), description: t('pendingDescription', { school: school.schoolName }) };
      case 'onboarding':
        return { title: t('onboardingTitle'), description: t('onboardingDescription', { school: school.schoolName }) };
      case 'placement-review':
        return {
          title: t('placementReviewTitle'),
          description: t('placementReviewDescription', { school: school.schoolName }),
        };
      case 'active':
        return {
          title: t('activeTitle'),
          description: school.groupName
            ? t('activeDescriptionWithGroup', { group: school.groupName, school: school.schoolName })
            : t('activeDescription', { school: school.schoolName }),
        };
      case 'rejected':
        return { title: t('rejectedTitle'), description: t('rejectedDescription', { school: school.schoolName }) };
      case 'left':
        return { title: t('leftTitle'), description: t('leftDescription', { school: school.schoolName }) };
    }
  })();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{school.schoolName}</p>
          <CardTitle>{copy.title}</CardTitle>
        </div>
        {school.status === 'rejected' && <Badge variant="error">{t('badgeRejected')}</Badge>}
        {school.status === 'left' && <Badge variant="muted">{t('badgeLeft')}</Badge>}
      </CardHeader>

      <CardDescription>{copy.description}</CardDescription>

      <div className="mt-4">
        <EnrollmentStepper status={school.status} />
      </div>
    </Card>
  );
}
