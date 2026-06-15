import { getTranslations } from 'next-intl/server';

import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { OnboardingSettingsForm } from '@/features/enrollment/components/onboarding-settings-form';

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

export default async function EnrollmentSettingsPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Enrollment.Settings');

  const provider = getEnrollmentProvider();
  const settings = await provider.getSchoolSettings(schoolSlug);

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
