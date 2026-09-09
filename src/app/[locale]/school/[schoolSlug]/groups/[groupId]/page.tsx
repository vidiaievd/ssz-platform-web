import { notFound } from 'next/navigation';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import {
  getGroup,
  getGroupCourseOutline,
  getGroupCourseView,
  getGroupMaterials,
} from '@/features/groups/api/queries';
import { canManageGroups } from '@/features/groups/lib/can-manage';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { GroupDetail } from '@/features/groups/components/group-detail';
import type { Session } from '@/features/groups/types';
import type { CurriculumPlan } from '@/features/teachers/types';

type Props = {
  params: Promise<{ schoolSlug: string; groupId: string; locale: string }>;
};

export default async function GroupDetailPage({ params }: Props) {
  const { schoolSlug, groupId } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const scheduling = getSchedulingProvider();
  // The schedule tab is one tab of five: scheduling being down empties it
  // rather than taking the whole group page with it.
  const degradeToEmpty = (err: unknown): Session[] => {
    if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
    return [];
  };

  const [data, sessions, plan, role] = await Promise.all([
    getGroup(school.id, groupId),
    scheduling.groupSessions(school.id, groupId).catch(degradeToEmpty),
    scheduling.getCurriculum(groupId).catch((): CurriculumPlan | null => null),
    getMySchoolRole(schoolSlug),
  ]);

  if (!data) notFound();

  const { roster, alerts, ...group } = data;
  const canManage = canManageGroups(role);
  const [courseView, materials, outline] = await Promise.all([
    getGroupCourseView(group),
    getGroupMaterials(group),
    getGroupCourseOutline(group),
  ]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto">
      <GroupDetail
        group={group}
        schoolId={school.id}
        roster={roster}
        alerts={alerts}
        sessions={sessions}
        outlineUnits={outline.units}
        planUnits={plan?.units ?? []}
        materials={materials}
        planProgressPct={plan?.progressPct ?? 0}
        courseView={courseView}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />
    </main>
  );
}
