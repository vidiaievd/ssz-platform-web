import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getPublicSchool } from '@/features/school/api/get-public-school';
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { PendingApprovals } from '@/features/enrollment/components/pending-approvals';
import type { Membership, MembershipStatus, MembershipSource } from '@/features/enrollment/types';
import type { LangCode, ISODate } from '@/features/groups/types';

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

type BackendMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: MembershipSource;
  language?: string;
  createdAt: string;
};

export default async function RequestsPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Enrollment.Approvals');

  const school = await getPublicSchool(schoolSlug);
  if (!school) notFound();

  const dto = await serverFetch<{ approvalMode: string }>({
    service: 'organization',
    path: `/schools/${school.schoolId}/enrollment/settings`,
  });

  const settings = resolveOnboardingSettings(
    dto ? { approval: { mode: dto.approvalMode as 'auto' | 'manual' } } : undefined,
  );

  // Guard: this page should only appear for manual approval schools
  if (settings.approval.mode !== 'manual') notFound();

  const result = await serverFetch<{ items: BackendMembership[] }>({
    service: 'organization',
    path: `/schools/${school.schoolId}/memberships`,
    query: { status: 'pending' },
  });

  const memberships: Membership[] = result.items.map((m) => ({
    id: m.id,
    schoolId: m.schoolId,
    schoolSlug,
    schoolName: school.schoolName,
    status: m.status,
    source: m.source,
    language: (m.language ?? 'nb') as LangCode,
    createdAt: (m.createdAt?.slice(0, 10) ?? '') as ISODate,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <PendingApprovals memberships={memberships} />
    </div>
  );
}
