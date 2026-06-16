import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getPublicSchool } from '@/features/school/api/get-public-school';
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { OnboardingStepper } from '@/features/enrollment/components/onboarding-stepper';
import type { Membership, MembershipStatus, MembershipSource } from '@/features/enrollment/types';
import type { LangCode, ISODate } from '@/features/groups/types';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string }>;
  searchParams: Promise<{ membershipId?: string }>;
};

type BackendMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: MembershipSource;
  language?: string;
  createdAt: string;
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

export default async function OnboardingPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { membershipId } = await searchParams;
  const t = await getTranslations('Enrollment.Onboarding');

  if (!membershipId) notFound();

  const school = await getPublicSchool(schoolSlug);
  if (!school) notFound();

  // Fetch membership and settings in parallel
  const [backendMembership, backendSettings] = await Promise.all([
    serverFetch<BackendMembership>({
      service: 'organization',
      path: `/schools/${school.schoolId}/memberships/me`,
    }).catch(() => null),
    serverFetch<BackendSettings>({
      service: 'organization',
      path: `/schools/${school.schoolId}/enrollment/settings`,
    }).catch(() => null),
  ]);

  if (!backendMembership || backendMembership.id !== membershipId) notFound();

  const membership: Membership = {
    id: backendMembership.id,
    schoolId: backendMembership.schoolId,
    schoolSlug,
    schoolName: school.schoolName,
    status: backendMembership.status,
    source: backendMembership.source,
    language: (backendMembership.language ?? 'nb') as LangCode,
    createdAt: (backendMembership.createdAt?.slice(0, 10) ?? '') as ISODate,
  };

  const settings = resolveOnboardingSettings(
    backendSettings
      ? {
          placement: {
            mode: backendSettings.placementMode as import('@/features/enrollment/types').PlacementMode,
            schoolTestId: backendSettings.schoolTestId,
            reusePlatformResult: backendSettings.reusePlatform,
            maxResultAgeDays: backendSettings.maxResultAgeDays,
          },
          interview: {
            required: backendSettings.interviewRequired,
            autoPlaceByScore: backendSettings.autoPlaceByScore,
          },
          availability: { collect: backendSettings.collectAvailability },
          approval: { mode: backendSettings.approvalMode as 'auto' | 'manual' },
        }
      : undefined,
  );

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
        platformResults={[]}
        today={new Date().toISOString().slice(0, 10) as ISODate}
      />
    </div>
  );
}
