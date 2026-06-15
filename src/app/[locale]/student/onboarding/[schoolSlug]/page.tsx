import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { OnboardingStepper } from '@/features/enrollment/components/onboarding-stepper';
import type { ISODate } from '@/features/groups/types';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string }>;
  searchParams: Promise<{ membershipId?: string }>;
};

export default async function OnboardingPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { membershipId } = await searchParams;
  const t = await getTranslations('Enrollment.Onboarding');

  if (!membershipId) notFound();

  const provider = getEnrollmentProvider();
  const [profile, rawSettings] = await Promise.all([
    provider.getProfile(''),         // TODO: derive from session once auth is wired
    provider.getSchoolSettings(schoolSlug),
  ]);

  const membership = profile.memberships.find((m) => m.id === membershipId);
  if (!membership || membership.schoolSlug !== schoolSlug) notFound();

  const settings = resolveOnboardingSettings(rawSettings);
  const today = new Date().toISOString().slice(0, 10) as ISODate;

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">
          {t('title', { school: membership.schoolName })}
        </h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <OnboardingStepper
        membership={membership}
        settings={settings}
        platformResults={profile.placement}
        today={today}
      />
    </div>
  );
}
