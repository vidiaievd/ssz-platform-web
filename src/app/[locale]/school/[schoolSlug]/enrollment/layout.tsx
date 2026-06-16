import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { getPublicSchool } from '@/features/school/api/get-public-school';
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { SettingsLayout } from '@/components/shared/settings-layout';

const ALLOWED_ROLES = ['OWNER', 'ADMIN'] as const;

type Props = {
  children: ReactNode;
  params: Promise<{ schoolSlug: string }>;
};

type BackendSettings = {
  approvalMode: string;
  placementMode: string;
  reusePlatform: boolean;
  interviewRequired: boolean;
  autoPlaceByScore: boolean;
  collectAvailability: boolean;
};

export default async function EnrollmentLayout({ children, params }: Props) {
  const { schoolSlug } = await params;

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const t = await getTranslations('Enrollment.Admin');

  const school = await getPublicSchool(schoolSlug);
  let showRequests = false;
  if (school) {
    const dto = await serverFetch<BackendSettings>({
      service: 'organization',
      path: `/schools/${school.schoolId}/enrollment/settings`,
    }).catch(() => null);
    const settings = resolveOnboardingSettings(
      dto ? { approval: { mode: dto.approvalMode as 'auto' | 'manual' } } : undefined,
    );
    showRequests = settings.approval.mode === 'manual';
  }

  const nav = [
    {
      href: `/school/${schoolSlug}/enrollment/settings`,
      label: t('navSettings'),
    },
    {
      href: `/school/${schoolSlug}/enrollment/placement`,
      label: t('navPlacement'),
    },
    ...(showRequests
      ? [
          {
            href: `/school/${schoolSlug}/enrollment/requests`,
            label: t('navRequests'),
          },
        ]
      : []),
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
