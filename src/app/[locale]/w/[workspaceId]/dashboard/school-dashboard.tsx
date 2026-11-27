import { headers } from 'next/headers';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { getSchoolByRef } from '@/features/school/api/get-school-by-ref';
import {
  deriveViewerRole,
  deriveSchoolType,
  deriveDataState,
  computeOnboarding,
  schoolMembersCount,
} from '@/features/dashboard/lib/derive';
import { canSeeWidget } from '@/features/dashboard/lib/roles';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import {
  fetchDashboardKpis,
  fetchAtRisk,
  fetchCourseHealth,
  fetchActivity,
  fetchGroupsHealth,
  fetchSchoolGroupFacts,
  fetchTeacherLoad,
  fetchGroupGaps,
  fetchSchoolSessionsOn,
  fetchWaitingWork,
  type WaitingWorkPayload,
} from '@/lib/dashboard/queries';
import { wsHref } from '@/features/workspaces/lib/href';
import { buildTodaysClasses, utcDay } from '@/features/dashboard/lib/todays-classes';
import { operationsKpis, withOperationsKpis } from '@/features/dashboard/lib/operations-widgets';

import type {
  WidgetData,
  Kpi,
  ActivityItem,
  CourseHealthRow,
  AtRiskStudent,
} from '@/features/dashboard/types';
import type {
  KpisPayload,
  AtRiskPayload,
  CourseHealthPayload,
  ActivityPayload,
  GroupGapsPayload,
  GroupGap,
  Unavailable,
} from '@/lib/dashboard/types';

import { KpiStrip } from '@/features/dashboard/components/kpi-strip';
import { ActivityFeed } from '@/features/dashboard/components/activity-feed';
import { OnboardingChecklist } from '@/features/dashboard/components/onboarding-checklist';
import { QuickActions } from '@/features/dashboard/components/quick-actions';
import { isWorkspaceWritable } from '@/features/school-lifecycle/api/get-workspace-lifecycle';
import { TipCard } from '@/features/dashboard/components/tip-card';
import { CourseHealth } from '@/features/dashboard/components/course-health';
import { AtRiskList } from '@/features/dashboard/components/at-risk-list';
import { TodaysClassesCard } from '@/features/dashboard/components/todays-classes-card';
import { TeacherQueueCard } from '@/features/dashboard/components/teacher-queue-card';
import { WidgetCard } from '@/features/dashboard/components/widget-card';
import { OperationsBanner } from '@/features/dashboard/components/operations-banner';
import { GroupsWidget } from '@/features/dashboard/components/groups-widget';
import { DeliveredAbsorbedRow } from '@/features/dashboard/components/delivered-absorbed-row';
import { TeacherWorkloadWidget } from '@/features/dashboard/components/teacher-workload-widget';
import { Skeleton } from '@/components/ui/skeleton';

type WidgetResult<T> = T | Unavailable;

function adaptKpis(result: WidgetResult<KpisPayload>): WidgetData<Kpi[]> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as KpisPayload;
  if (!payload.kpis || payload.kpis.length === 0) return { status: 'empty' };
  const kpis: Kpi[] = payload.kpis.map((k) => ({
    key: k.key as Kpi['key'],
    value: k.value,
    delta: k.delta ?? undefined,
    trend: k.trend ?? undefined,
    hint: k.hint,
    hintValues: k.hintValues,
    spark: k.spark,
    sub: k.sub,
  }));
  return { status: 'ok', data: kpis };
}

function tagToIconKey(tag: ActivityItem['tag']): ActivityItem['iconKey'] {
  switch (tag) {
    case 'people': return 'user';
    case 'content': return 'book';
    case 'review': return 'flag';
    case 'milestone': return 'star';
    default: return 'user';
  }
}

function tagToTone(tag: ActivityItem['tag']): ActivityItem['tone'] {
  switch (tag) {
    case 'people': return 'primary';
    case 'content': return 'success';
    case 'review': return 'warning';
    case 'milestone': return 'success';
    default: return 'neutral';
  }
}

function adaptGroupGaps(result: WidgetResult<GroupGapsPayload>): WidgetData<GroupGap[]> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as GroupGapsPayload;
  // An empty list is a real answer — a school with no groups yet — and the widget says so
  // itself rather than disappearing.
  return { status: 'ok', data: payload.groups ?? [] };
}

function adaptActivity(result: WidgetResult<ActivityPayload>): WidgetData<ActivityItem[]> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as ActivityPayload;
  if (!payload.items || payload.items.length === 0) return { status: 'empty' };
  const items: ActivityItem[] = payload.items.map((item) => ({
    id: item.id,
    who: item.who ?? null,
    what: item.what,
    eventType: item.eventType,
    target: item.target ?? '',
    time: item.occurredAt,
    iconKey: tagToIconKey(item.tag),
    tone: tagToTone(item.tag),
    tag: item.tag,
  }));
  return { status: 'ok', data: items };
}

function adaptCourseHealth(result: WidgetResult<CourseHealthPayload>): WidgetData<CourseHealthRow[]> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as CourseHealthPayload;
  if (!payload.courses || payload.courses.length === 0) return { status: 'empty' };
  const rows: CourseHealthRow[] = payload.courses.map((c) => ({
    id: c.courseId,
    name: c.name,
    lang: c.lang,
    students: c.enrollment,
    completion: c.completion,
    trend: c.trend,
    flag: c.dropoff ? 'dropoff' : null,
  }));
  return { status: 'ok', data: rows };
}

function adaptAtRisk(result: WidgetResult<AtRiskPayload>): WidgetData<{ students: AtRiskStudent[]; total: number }> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as AtRiskPayload;
  if (!payload.students || payload.students.length === 0) return { status: 'empty' };
  const students: AtRiskStudent[] = payload.students.map((s) => ({
    userId: s.userId,
    name: s.name,
    course: s.course ?? '',
    lastSeen: s.lastSeen ?? '',
    progress: s.progress,
    lang: s.lang ?? '',
  }));
  return { status: 'ok', data: { students, total: payload.total } };
}

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function SchoolDashboard({ params }: Props) {
  const { workspaceId } = await params;
  await headers(); // opt into dynamic rendering

  // ── 1. Resolve school + viewer role ────────────────────────────────────────
  const [user, school] = await Promise.all([
    getCurrentUser(),
    getSchoolByRef(workspaceId),
  ]);

  if (!school) {
    return (
      <main className="p-6">
        <p className="text-(--ssz-text-muted)">School not found.</p>
      </main>
    );
  }

  const role = user?.userId ? deriveViewerRole(school, user.userId) : 'admin';
  const schoolType = deriveSchoolType(school);

  // ── 2. Parallel widget data fetch ──────────────────────────────────────────
  // «Today's classes» is drawn for hybrid schools only — an online one is not asked.
  const hybrid = schoolType === 'hybrid';
  // The work waiting for review: the owner's card and the teacher's read the same queue.
  const seesQueue = role === 'owner' || role === 'teacher';
  const [kpis, atRisk, courseHealth, activity, groupsHealthWidget, teacherWorkloadWidget, groupGaps, todaysSessions, groupFacts, waitingWork] =
    await Promise.all([
      fetchDashboardKpis(school.id),
      fetchAtRisk(school.id, 3),
      fetchCourseHealth(school.id),
      fetchActivity(school.id, 6),
      fetchGroupsHealth(school.id, { role, userId: user?.userId ?? null }),
      fetchTeacherLoad(school.id),
      fetchGroupGaps(school.id),
      hybrid
        ? fetchSchoolSessionsOn(school.id, utcDay(new Date()))
        : Promise.resolve({ status: 'unavailable' } as const),
      hybrid ? fetchSchoolGroupFacts(school.id) : Promise.resolve({ status: 'unavailable' } as const),
      seesQueue
        ? fetchWaitingWork(school.id, role === 'owner' ? 'school' : 'mine')
        : Promise.resolve({ status: 'unavailable' } as const),
    ]);

  // ── 3. Adapt to WidgetData<T> + derive data state ─────────────────────────
  // Groups and load are not analytics' facts: their tiles come from the two cards (OQ-108).
  const kpisWidget = withOperationsKpis(
    adaptKpis(kpis),
    operationsKpis(groupsHealthWidget, teacherWorkloadWidget, { role, userId: user?.userId ?? null }),
  );
  const activityWidget = adaptActivity(activity);
  const courseHealthWidget = adaptCourseHealth(courseHealth);
  const atRiskWidget = adaptAtRisk(atRisk);
  const groupGapsWidget = adaptGroupGaps(groupGaps);
  const waitingWorkWidget: WidgetData<WaitingWorkPayload> =
    'status' in waitingWork ? { status: 'unavailable' } : { status: 'ok', data: waitingWork };
  // Names and head counts from organization: a row of an unreadable group still shows, unnamed.
  const todaysClassesWidget = buildTodaysClasses(todaysSessions, Array.isArray(groupFacts) ? groupFacts : []);

  const hasActivity = activityWidget.status === 'ok' && activityWidget.data.length > 0;
  const coursesCount = courseHealthWidget.status === 'ok' ? courseHealthWidget.data.length : 0;
  const groupsCount = groupsHealthWidget.status === 'ok' ? groupsHealthWidget.data.activeCount : 0;
  // The owner is not on the roster (schools.ownerId), so they count on top of it. A fixed 1 here
  // kept every school out of the "full" state: course health, the review queue and the
  // operations banner never showed.
  const membersCount = schoolMembersCount(school);

  const dataState = deriveDataState({ membersCount, coursesCount, hasActivity });

  // ── 4. Derive operations banner counts ────────────────────────────────────
  const conflictCount =
    teacherWorkloadWidget.status === 'ok'
      ? teacherWorkloadWidget.data.conflictCount
      : 0;
  const noTeacherCount =
    groupsHealthWidget.status === 'ok'
      ? groupsHealthWidget.data.groups.filter((g) => g.alerts.some((a) => a.type === 'no-primary')).length
      : 0;

  // ── 5. Compute onboarding ──────────────────────────────────────────────────
  const hasAssignedTeacher =
    groupsHealthWidget.status === 'ok'
      ? groupsHealthWidget.data.groups.some((g) => g.primaryTeacherName !== null)
      : false;

  const onboarding = computeOnboarding({
    school: { avatarUrl: school.avatarUrl, description: school.description },
    membersCount,
    coursesCount,
    groupsCount,
    hasPublishedLesson: coursesCount > 0,
    hasPendingInvitation: false,
    hasAssignedTeacher,
  });

  const ctx = { role, dataState, schoolType };
  const tLoading = await getTranslations('School.dashboard.loadingTitle');
  const schoolSlugDisplay = school.slug ?? school.id;
  // Suspended or closed: no setup checklist and no "create / invite" shortcuts (plan 90, block 9).
  const writable = await isWorkspaceWritable(workspaceId);

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-page mx-auto">
      {/* Page header */}
      <div>
        <h1 className="font-[Lora] text-2xl sm:text-3xl font-semibold text-(--ssz-text-primary)">
          {school.name}
        </h1>
        {school.description && (
          <p className="mt-1 text-sm text-(--ssz-text-secondary)">{school.description}</p>
        )}
      </div>

      {/* Operations banner — above trial, above KPIs, non-dismissible */}
      {canSeeWidget('operationsBanner', ctx) && (
        <OperationsBanner
          conflictCount={conflictCount}
          noTeacherCount={noTeacherCount}
          workspaceId={schoolSlugDisplay}
        />
      )}

      {/* Trial banner (owner-only, when trial data available) */}
      {canSeeWidget('trialBanner', ctx) && null /* trial always null until billing service */}

      {/* Onboarding checklist (hidden at full state or for editor) */}
      {canSeeWidget('onboarding', ctx) && writable && (
        <OnboardingChecklist onboarding={onboarding} workspaceId={workspaceId} />
      )}

      {/* KPI strip — always visible */}
      <Suspense fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-27 rounded-md" />)}
        </div>
      }>
        <KpiStrip kpis={kpisWidget} role={role} />
      </Suspense>

      {/* Main two-column grid (desktop) → single column (mobile/tablet) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-5 items-start">

        {/* Left column */}
        <div className="space-y-5">

          {/* Groups widget — leads the left column (v3) */}
          {canSeeWidget('groupsWidget', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('groups')} loading />}>
              <GroupsWidget
                groupsHealth={groupsHealthWidget}
                role={role}
                workspaceId={schoolSlugDisplay}
              />
            </Suspense>
          )}

          {/* Taught against taken away (plan 58, screen D) */}
          {canSeeWidget('groupGaps', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('groupGaps')} loading />}>
              <DeliveredAbsorbedRow gaps={groupGapsWidget} workspaceId={schoolSlugDisplay} />
            </Suspense>
          )}

          {/* Activity feed */}
          {canSeeWidget('activity', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('activity')} loading />}>
              <ActivityFeed activity={activityWidget} />
            </Suspense>
          )}

          {/* Course health — owner/admin, full state */}
          {canSeeWidget('courseHealth', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('courseHealth')} loading />}>
              <CourseHealth courseHealth={courseHealthWidget} />
            </Suspense>
          )}

          {/* At-risk students — owner/admin, non-empty */}
          {canSeeWidget('atRisk', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('atRisk')} loading />}>
              <AtRiskList
                atRisk={atRiskWidget}
                workspaceId={schoolSlugDisplay}
                schoolId={school.id}
              />
            </Suspense>
          )}

          {/* Today's classes — hybrid only */}
          {canSeeWidget('todaysClasses', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('todaysClasses')} loading />}>
              <TodaysClassesCard
                todaysClasses={todaysClassesWidget}
                teacherView={role === 'teacher'}
              />
            </Suspense>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Teacher workload — leads the right column (v3) */}
          {canSeeWidget('teacherWorkload', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('teacherWorkload')} loading />}>
              <TeacherWorkloadWidget
                teacherWorkload={teacherWorkloadWidget}
                workspaceId={schoolSlugDisplay}
              />
            </Suspense>
          )}

          {/* Quick actions */}
          <QuickActions role={role} workspaceId={schoolSlugDisplay} readOnly={!writable} />

          {/* Work waiting for review — the owner's whole school (to oversight), full state */}
          {canSeeWidget('reviewQueue', ctx) && (
            <Suspense fallback={<WidgetCard title={tLoading('reviewQueue')} loading />}>
              <TeacherQueueCard work={waitingWorkWidget} href={wsHref(schoolSlugDisplay, 'review/oversight')} whose="school" />
            </Suspense>
          )}

          {/* Work waiting for review — the teacher's own groups (to their inbox) */}
          {canSeeWidget('teacherQueue', ctx) && (
            <TeacherQueueCard work={waitingWorkWidget} href={wsHref(schoolSlugDisplay, 'review')} />
          )}

          {/* Contextual tip */}
          {canSeeWidget('tipCard', ctx) && (
            <TipCard role={role} dataState={dataState} />
          )}
        </div>
      </div>
    </main>
  );
}
