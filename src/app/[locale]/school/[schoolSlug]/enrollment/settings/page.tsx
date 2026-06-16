import { getTranslations } from 'next-intl/server';

import { getPublicSchool } from '@/features/school/api/get-public-school';
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { OnboardingSettingsForm } from '@/features/enrollment/components/onboarding-settings-form';
import type { PlacementMode, SchoolOnboardingSettings } from '@/features/enrollment/types';

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

type BackendSettings = {
  placementMode: string;
  schoolTestId?: string;
  reusePlatform: boolean;
  maxResultAgeDays?: number;
  interviewRequired: boolean;
  autoPlaceByScore: boolean;
  collectAvailability: boolean;
  approvalMode: string;
};

export default async function EnrollmentSettingsPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Enrollment.Settings');

  const school = await getPublicSchool(schoolSlug);
  let settings: SchoolOnboardingSettings = resolveOnboardingSettings();

  if (school) {
    const dto = await serverFetch<BackendSettings>({
      service: 'organization',
      path: `/schools/${school.schoolId}/enrollment/settings`,
    }).catch(() => null);

    if (dto) {
      settings = resolveOnboardingSettings({
        placement: {
          mode: dto.placementMode as PlacementMode,
          schoolTestId: dto.schoolTestId,
          reusePlatformResult: dto.reusePlatform,
          maxResultAgeDays: dto.maxResultAgeDays,
        },
        interview: {
          required: dto.interviewRequired,
          autoPlaceByScore: dto.autoPlaceByScore,
        },
        availability: { collect: dto.collectAvailability },
        approval: { mode: dto.approvalMode as 'auto' | 'manual' },
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <OnboardingSettingsForm schoolSlug={schoolSlug} initialSettings={settings} />
    </div>
  );
}
