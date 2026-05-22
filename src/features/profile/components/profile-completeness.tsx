'use client';

import { useTranslations } from 'next-intl';

import { ProgressBar } from '@/components/ui/progress';
import { useMyProfile } from '../api/use-my-profile';
import { calculateCompleteness } from '../lib/calculate-completeness';

export function ProfileCompleteness() {
  const t = useTranslations('Profile');
  const { data: profile } = useMyProfile();

  if (!profile) return null;

  const { score, missingFields } = calculateCompleteness(profile);
  const nextField = missingFields[0];

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('completeness.label')}</span>
        <span className="text-sm font-semibold tabular-nums">{score}%</span>
      </div>

      <ProgressBar value={score} height={6} showLabel={false} />

      {nextField && score < 100 && (
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
