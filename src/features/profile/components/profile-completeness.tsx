'use client';

import { useTranslations } from 'next-intl';

import { ProgressBar } from '@/components/ui/progress';
import { useMyProfile } from '../api/use-my-profile';
import { useMyTeachingProfile } from '../api/use-my-teaching-profile';
import { useMyStudentProfile } from '../api/use-my-student-profile';
import { useMyTutorProfile } from '../api/use-my-tutor-profile';
import { calculateCompleteness, type FacetExtra } from '../lib/calculate-completeness';
import { useProfileSettingsForm } from '../hooks/use-profile-settings-form';

const PRIORITY_ORDER = ['displayName', 'avatarUrl', 'bio', 'teachingLanguages', 'targetLanguages', 'hourlyRateCurrency', 'timezone', 'contactEmail'];

export function ProfileCompleteness() {
  const t = useTranslations('Profile');
  const { data: profile } = useMyProfile();
  const { data: teaching } = useMyTeachingProfile();
  const { data: student } = useMyStudentProfile();
  const { data: tutor } = useMyTutorProfile();
  const { isLoading: formLoading } = useProfileSettingsForm();

  if (!profile || formLoading) return null;

  const extra: FacetExtra = {
    hasTeaching: teaching != null || profile.hasTutorProfile,
    hasTutor: profile.hasTutorProfile,
    hasLearner: profile.hasStudentProfile,
    teachingLanguagesCount: teaching?.languages?.length ?? 0,
    targetLanguagesCount: student?.targetLanguages?.length ?? 0,
    hourlyRate: tutor?.hourlyRate ?? null,
    currency: tutor?.currency ?? null,
  };

  const { score, missingFields } = calculateCompleteness(profile, extra);

  if (score >= 100) return null;

  const nextField = PRIORITY_ORDER.find((k) => missingFields.includes(k)) ?? missingFields[0];

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('completeness.label')}</span>
        <span className="text-sm font-semibold tabular-nums">{score}%</span>
      </div>

      <ProgressBar value={score} height={6} showLabel={false} />

      {nextField && (
        <p className="text-xs text-(--ssz-text-muted)">
          {t('completeness.nudge', {
            field: t(
              `completeness.fields.${nextField}` as Parameters<typeof t>[0],
            ),
          })}
        </p>
      )}
    </div>
  );
}
