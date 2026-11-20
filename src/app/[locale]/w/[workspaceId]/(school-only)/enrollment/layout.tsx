import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { resolveSchoolWorkspace } from '@/features/workspaces/api/resolve-school-workspace';
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { SettingsLayout } from '@/components/shared/settings-layout';
import { wsHref } from '@/features/workspaces/lib/href';

const ALLOWED_ROLES = ['OWNER', 'ADMIN'] as const;

type Props = {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
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
  const { workspaceId } = await params;

  const role = await getMySchoolRole(workspaceId);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const t = await getTranslations('Enrollment.Admin');

  const school = await resolveSchoolWorkspace(workspaceId);
  let showRequests = false;
  if (school) {
    const [dto, pending] = await Promise.all([
      serverFetch<BackendSettings>({
        service: 'organization',
        path: `/schools/${school.id}/enrollment/settings`,
      }).catch(() => null),
      serverFetch<{ items: unknown[] }>({
        service: 'organization',
        path: `/schools/${school.id}/memberships`,
        query: { status: 'pending' },
      }).catch(() => null),
    ]);
    const settings = resolveOnboardingSettings(
      dto ? { approval: { mode: dto.approvalMode as 'auto' | 'manual' } } : undefined,
    );
    // Manual approval always has the tab; auto-approval only while requests wait for a seat.
    showRequests = settings.approval.mode === 'manual' || (pending?.items.length ?? 0) > 0;
  }

  const nav = [
    {
      href: wsHref(workspaceId, 'enrollment/settings'),
      label: t('navSettings'),
    },
    {
      href: wsHref(workspaceId, 'enrollment/placement'),
      label: t('navPlacement'),
    },
    ...(showRequests
      ? [
          {
            href: wsHref(workspaceId, 'enrollment/requests'),
            label: t('navRequests'),
          },
        ]
      : []),
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
