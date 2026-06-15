import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getGroups } from '@/features/groups/api/queries';
import { PlacementQueue } from '@/features/enrollment/components/placement-queue';
import type { Group } from '@/features/groups/types';

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

export default async function PlacementQueuePage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Enrollment.PlacementQueue');

  const [school, provider] = await Promise.all([
    getSchoolBySlug(schoolSlug),
    Promise.resolve(getEnrollmentProvider()),
  ]);
  if (!school) notFound();

  const [memberships, rawGroups] = await Promise.all([
    provider.listPlacementQueue(schoolSlug),
    getGroups(school.id),
  ]);

  // getGroups returns GroupHealthRowVM; convert to minimal Group shape for suggestGroups
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
