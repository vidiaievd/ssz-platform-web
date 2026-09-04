import { notFound } from 'next/navigation';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { getGroup, getGroupCourseView } from '@/features/groups/api/queries';
import { canManageGroups } from '@/features/groups/lib/can-manage';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { GroupDetail } from '@/features/groups/components/group-detail';
import type { Lesson } from '@/features/groups/types';
import type { CurriculumPlan } from '@/features/teachers/types';

/** How far back the "recent lessons" list on the schedule tab looks. */
const RECENT_WINDOW_DAYS = 30;
const RECENT_LIMIT = 8;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  params: Promise<{ schoolSlug: string; groupId: string; locale: string }>;
};

export default async function GroupDetailPage({ params }: Props) {
  const { schoolSlug, groupId } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const scheduling = getSchedulingProvider();
  const degradeToEmpty = (err: unknown): Lesson[] => {
    if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
    return [];
  };

  const [data, lessons, recentAll, plan, role] = await Promise.all([
    getGroup(school.id, groupId),
    scheduling.nextLessons(groupId, 10).catch(degradeToEmpty),
    scheduling
      .lessonsInRange(groupId, isoDaysAgo(RECENT_WINDOW_DAYS), isoDaysAgo(0))
      .catch(degradeToEmpty),
    scheduling.getCurriculum(groupId).catch((): CurriculumPlan | null => null),
    getMySchoolRole(schoolSlug),
  ]);

  // Newest first, cancelled lessons left out — there is nothing to record about them.
  const recentLessons = recentAll
    .filter((l) => l.status !== 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
    .slice(0, RECENT_LIMIT);

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
        recentLessons={recentLessons}
        planUnits={plan?.units ?? []}
        courseView={courseView}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />
    </main>
  );
}
