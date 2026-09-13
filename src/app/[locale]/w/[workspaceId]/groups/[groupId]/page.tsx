import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';
import { wsHref } from '@/features/workspaces/lib/href';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import {
  getGroup,
  getGroupCourseOutline,
  getGroupCourseView,
  getGroupMaterials,
  getSchoolTeachers,
} from '@/features/groups/api/queries';
import { canManageGroups, canSeePersonalResults } from '@/features/groups/lib/can-manage';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { GroupDetail } from '@/features/groups/components/group-detail';
import type { Session } from '@/features/groups/types';
import type { CurriculumPlan } from '@/features/teachers/types';
import type { TabKey } from '@/features/groups/components/group-tabs';

/**
 * What a private tutor's group page is.
 *
 * Teachers and Materials are a school's tabs: a tutor is the only teacher of their group,
 * and they hand out materials as assignments. What is left is the four things they came
 * for (plan 59, §5.2).
 */
const TUTOR_TABS: TabKey[] = ['overview', 'students', 'schedule', 'progress'];

/** What a student passes an exam on when the school has said nothing else. */
const DEFAULT_PASS_MARK = 60;

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function GroupDetailPage({ params }: Props) {
  const { workspaceId, groupId } = await params;

  // A group belongs to a workspace, not to a school: a tutor's small groups live in
  // theirs, which is why this screen is no longer behind the school-only guard.
  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();
  const isSolo = workspace.kind === 'SOLO';

  const scheduling = getSchedulingProvider();
  // The schedule tab is one tab of five: scheduling being down empties it
  // rather than taking the whole group page with it.
  const degradeToEmpty = (err: unknown): Session[] => {
    if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
    return [];
  };

  const [data, sessions, passMark, plan, role] = await Promise.all([
    getGroup(workspace.id, groupId),
    scheduling.groupSessions(workspace.id, groupId).catch(degradeToEmpty),
    // The school's pass mark, and the spec's default when the school has none.
    scheduling.gradingPolicy(workspace.id).catch(() => DEFAULT_PASS_MARK),
    scheduling.getCurriculum(groupId).catch((): CurriculumPlan | null => null),
    getMySchoolRole(workspaceId),
  ]);
  // Who is looking: a teacher may only record the sessions they teach.
  const viewer = await getCurrentUser();
  // A tutor came here from their roster, not from a list of groups, and the link back
  // should say so.
  const tutorStrings = isSolo ? await getTranslations('Tutor.students') : null;

  if (!data) notFound();

  const { roster, alerts, ...group } = data;

  // The group a solo workspace keeps for itself holds everybody and is never shown as a
  // screen — it has no name on display and no page (plan 59, §5.1).
  if (isSolo) {
    const home = await getTutorWorkspace();
    if (home?.groupId === group.id) notFound();
  }

  const canManage = canManageGroups(role);
  const [courseView, materials, outline, schoolTeachers] = await Promise.all([
    getGroupCourseView(group),
    getGroupMaterials(group),
    getGroupCourseOutline(group),
    // The whole school, not just this group's teachers: cover is often external.
    getSchoolTeachers(workspace.id),
  ]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto">
      <GroupDetail
        group={group}
        schoolId={workspace.id}
        roster={roster}
        alerts={alerts}
        sessions={sessions}
        outlineUnits={outline.units}
        passMark={passMark}
        schoolTeachers={schoolTeachers}
        viewerId={viewer?.userId ?? null}
        planUnits={plan?.units ?? []}
        materials={materials}
        planProgressPct={plan?.progressPct ?? 0}
        courseView={courseView}
        workspaceId={workspaceId}
        canManage={canManage}
        canSeePersonalResults={canSeePersonalResults(role)}
        {...(isSolo && {
          tabs: TUTOR_TABS,
          listHref: wsHref(workspaceId, 'students'),
          listLabel: tutorStrings ? tutorStrings('backToStudents') : undefined,
        })}
      />
    </main>
  );
}
