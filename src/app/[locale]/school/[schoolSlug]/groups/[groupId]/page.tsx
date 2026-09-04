import { notFound } from 'next/navigation';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { getGroup, getGroupCourseView } from '@/features/groups/api/queries';
import { canManageGroups } from '@/features/groups/lib/can-manage';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { GroupDetail } from '@/features/groups/components/group-detail';
import type { Lesson } from '@/features/groups/types';

type Props = {
  params: Promise<{ schoolSlug: string; groupId: string; locale: string }>;
};

export default async function GroupDetailPage({ params }: Props) {
  const { schoolSlug, groupId } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const [data, lessons, role] = await Promise.all([
    getGroup(school.id, groupId),
    getSchedulingProvider()
      .nextLessons(groupId, 10)
      .catch((err): Lesson[] => {
        if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
        return [];
      }),
    getMySchoolRole(schoolSlug),
  ]);

  if (!data) notFound();

  const { roster, alerts, ...group } = data;
  const canManage = canManageGroups(role);
  const courseView = await getGroupCourseView(group);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <GroupDetail
        group={group}
        schoolId={school.id}
        roster={roster}
        alerts={alerts}
        lessons={lessons}
        courseView={courseView}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />
    </main>
  );
}
