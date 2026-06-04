import { notFound } from 'next/navigation';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getGroup } from '@/features/groups/api/queries';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { GroupDetail } from '@/features/groups/components/group-detail';

type Props = {
  params: Promise<{ schoolSlug: string; groupId: string; locale: string }>;
};

export default async function GroupDetailPage({ params }: Props) {
  const { schoolSlug, groupId } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const [data, lessons] = await Promise.all([
    getGroup(school.id, groupId),
    getSchedulingProvider().nextLessons(groupId, 10),
  ]);

  if (!data) notFound();

  const { roster, alerts, ...group } = data;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <GroupDetail
        group={group}
        roster={roster}
        alerts={alerts}
        lessons={lessons}
        schoolSlug={schoolSlug}
      />
    </main>
  );
}
