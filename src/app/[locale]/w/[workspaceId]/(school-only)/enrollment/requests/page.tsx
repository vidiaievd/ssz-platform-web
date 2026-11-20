import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { resolveSchoolWorkspace } from '@/features/workspaces/api/resolve-school-workspace';
import { serverFetch } from '@/lib/api/server-fetcher';
import { SeatsBadge } from '@/features/school-seats/components/seats-badge';
import { PendingApprovals } from '@/features/enrollment/components/pending-approvals';
import type { Membership, MembershipStatus, MembershipSource } from '@/features/enrollment/types';
import type { CEFR, LangCode, ISODate } from '@/features/groups/types';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

type BackendMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: MembershipSource;
  language?: string;
  selfReportedLevel?: CEFR;
  blockedReason?: 'no_seats' | null;
  createdAt: string;
};

export default async function RequestsPage({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Enrollment.Approvals');

  const school = await resolveSchoolWorkspace(workspaceId);
  if (!school) notFound();

  // Open under either approval mode: auto-approval leaves a request `pending` when the school
  // has no seat for it (`blockedReason: no_seats`), and this is where the owner approves it
  // once seats are added (plan 90, live check, session 12).
  const result = await serverFetch<{ items: BackendMembership[] }>({
    service: 'organization',
    path: `/schools/${school.id}/memberships`,
    query: { status: 'pending' },
  });

  const memberships: Membership[] = result.items.map((m) => ({
    id: m.id,
    schoolId: m.schoolId,
    schoolSlug: school.slug ?? workspaceId,
    schoolName: school.name,
    status: m.status,
    source: m.source,
    language: (m.language ?? 'nb') as LangCode,
    selfReportedLevel: m.selfReportedLevel,
    blockedReason: m.blockedReason ?? null,
    createdAt: (m.createdAt?.slice(0, 10) ?? '') as ISODate,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <SeatsBadge schoolId={school.id} />

      <PendingApprovals memberships={memberships} />
    </div>
  );
}
