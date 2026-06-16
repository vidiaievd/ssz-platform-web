import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getPublicSchool } from '@/features/school/api/get-public-school';
import { serverFetch } from '@/lib/api/server-fetcher';
import { getGroups } from '@/features/groups/api/queries';
import { PlacementQueue } from '@/features/enrollment/components/placement-queue';
import type { Membership, MembershipStatus, MembershipSource } from '@/features/enrollment/types';
import type { Group, LangCode, ISODate } from '@/features/groups/types';

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

export default async function PlacementQueuePage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Enrollment.PlacementQueue');

  const school = await getPublicSchool(schoolSlug);
  if (!school) notFound();

  const [result, rawGroups] = await Promise.all([
    serverFetch<{ items: BackendMembership[] }>({
      service: 'organization',
      path: `/schools/${school.schoolId}/memberships`,
      query: { status: 'placement-review' },
    }).catch(() => ({ items: [] as BackendMembership[] })),
    getGroups(school.schoolId).catch(() => []),
  ]);

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

  const groups: Group[] = rawGroups.map((g) => ({
    id: g.id,
    name: g.name,
    courseId: null,
    lang: g.lang,
    level: g.level,
    status: g.status,
    mode: g.mode,
    capacity: g.capacity,
    studentCount: g.studentCount,
    startDate: null,
    endDate: null,
    teachers: [],
    slots: [],
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <PlacementQueue memberships={memberships} groups={groups} />
    </div>
  );
}
