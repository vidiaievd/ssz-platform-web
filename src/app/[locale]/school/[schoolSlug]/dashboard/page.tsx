import { headers } from 'next/headers';
import { Suspense } from 'react';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { deriveViewerRole, deriveSchoolType, deriveDataState, computeOnboarding } from '@/features/dashboard/lib/derive';
import { canSeeWidget } from '@/features/dashboard/lib/roles';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import {
  fetchDashboardKpis,
  fetchAtRisk,
  fetchCourseHealth,
  fetchActivity,
  fetchGroupsHealth,
  fetchTeacherLoad,
} from '@/lib/dashboard/queries';

import type {
  WidgetData,
  Kpi,
  ActivityItem,
  CourseHealthRow,
  AtRiskStudent,
  GroupsHealthData,
  TeacherWorkloadData,
  Alert,
  AlertType,
  AlertSeverity,
} from '@/features/dashboard/types';
import type {
  KpisPayload,
  AtRiskPayload,
  CourseHealthPayload,
  ActivityPayload,
  GroupsHealthPayload,
  TeacherLoadPayload,
  Unavailable,
} from '@/lib/dashboard/types';

import { KpiStrip } from '@/features/dashboard/components/kpi-strip';
import { ActivityFeed } from '@/features/dashboard/components/activity-feed';
import { OnboardingChecklist } from '@/features/dashboard/components/onboarding-checklist';
import { QuickActions } from '@/features/dashboard/components/quick-actions';
import { TipCard } from '@/features/dashboard/components/tip-card';
import { CourseHealth } from '@/features/dashboard/components/course-health';
import { AtRiskList } from '@/features/dashboard/components/at-risk-list';
import { ReviewQueueCard } from '@/features/dashboard/components/review-queue-card';
import { TodaysClassesCard } from '@/features/dashboard/components/todays-classes-card';
import { TeacherQueueCard } from '@/features/dashboard/components/teacher-queue-card';
import { WidgetCard } from '@/features/dashboard/components/widget-card';
import { OperationsBanner } from '@/features/dashboard/components/operations-banner';
import { GroupsWidget } from '@/features/dashboard/components/groups-widget';
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

function adaptActivity(result: WidgetResult<ActivityPayload>): WidgetData<ActivityItem[]> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as ActivityPayload;
  if (!payload.items || payload.items.length === 0) return { status: 'empty' };
  const items: ActivityItem[] = payload.items.map((item) => ({
    id: item.id,
    who: item.who ?? 'Someone',
    what: item.what,
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

function adaptGroupsHealth(result: WidgetResult<GroupsHealthPayload>): WidgetData<GroupsHealthData> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as GroupsHealthPayload;
  if (!payload.groups || payload.groups.length === 0) return { status: 'empty' };
  return {
    status: 'ok',
    data: {
      activeCount: payload.activeCount,
      attentionCount: payload.attentionCount,
      groups: payload.groups.map((g) => ({
        id: g.id,
        name: g.name,
        lang: g.lang,
        level: g.level,
        primaryTeacherName: g.primaryTeacherName,
        studentCount: g.studentCount,
        max: g.max,
        alerts: g.alerts.map((a) => ({
          type: a.type as AlertType,
          severity: a.severity as AlertSeverity,
          label: a.label,
        } satisfies Alert)),
      })),
    },
  };
}

function adaptTeacherWorkload(result: WidgetResult<TeacherLoadPayload>): WidgetData<TeacherWorkloadData> {
  if ('status' in (result as object) && (result as Unavailable).status === 'unavailable') {
    return { status: 'unavailable' };
  }
  const payload = result as TeacherLoadPayload;
  if (!payload.teachers || payload.teachers.length === 0) return { status: 'empty' };
  return {
    status: 'ok',
    data: {
      overloadedCount: payload.overloadedCount,
      avgLoadPct: payload.avgLoadPct,
      conflictCount: payload.conflictCount,
      teachers: payload.teachers,
    },
  };
}

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function SchoolDashboardPage({ params }: Props) {
  const { schoolSlug } = await params;
  await headers(); // opt into dynamic rendering

  // ── 1. Resolve school + viewer role ────────────────────────────────────────
  const [user, school] = await Promise.all([
    getCurrentUser(),
    getSchoolBySlug(schoolSlug),
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
  const [kpis, atRisk, courseHealth, activity, groupsHealth, teacherWorkload] = await Promise.all([
    fetchDashboardKpis(school.id),
    fetchAtRisk(school.id, 3),
    fetchCourseHealth(school.id),
    fetchActivity(school.id, 6),
    fetchGroupsHealth(school.id, role),
    fetchTeacherLoad(school.id),
  ]);

  // ── 3. Adapt to WidgetData<T> + derive data state ─────────────────────────
  const kpisWidget = adaptKpis(kpis);
  const activityWidget = adaptActivity(activity);
  const courseHealthWidget = adaptCourseHealth(courseHealth);
  const atRiskWidget = adaptAtRisk(atRisk);
  const groupsHealthWidget = adaptGroupsHealth(groupsHealth);
  const teacherWorkloadWidget = adaptTeacherWorkload(teacherWorkload);

  const hasActivity = activityWidget.status === 'ok' && activityWidget.data.length > 0;
  const coursesCount = courseHealthWidget.status === 'ok' ? courseHealthWidget.data.length : 0;
  const groupsCount = groupsHealthWidget.status === 'ok' ? groupsHealthWidget.data.activeCount : 0;
  const membersCount = 1; // conservative — full count not fetched here

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
  const schoolSlugDisplay = school.slug ?? school.id;

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
          schoolSlug={schoolSlugDisplay}
        />
      )}

      {/* Trial banner (owner-only, when trial data available) */}
      {canSeeWidget('trialBanner', ctx) && null /* trial always null until billing service */}

      {/* Onboarding checklist (hidden at full state or for editor) */}
      {canSeeWidget('onboarding', ctx) && (
        <OnboardingChecklist onboarding={onboarding} />
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
            <Suspense fallback={<WidgetCard title="Groups" loading />}>
              <GroupsWidget
                groupsHealth={groupsHealthWidget}
                role={role}
                schoolSlug={schoolSlugDisplay}
              />
            </Suspense>
          )}

          {/* Activity feed */}
          {canSeeWidget('activity', ctx) && (
            <Suspense fallback={<WidgetCard title="Recent activity" loading />}>
              <ActivityFeed activity={activityWidget} />
            </Suspense>
          )}

          {/* Course health — owner/admin, full state */}
          {canSeeWidget('courseHealth', ctx) && (
            <Suspense fallback={<WidgetCard title="Course health" loading />}>
              <CourseHealth courseHealth={courseHealthWidget} />
            </Suspense>
          )}

          {/* At-risk students — owner/admin, non-empty */}
          {canSeeWidget('atRisk', ctx) && (
            <Suspense fallback={<WidgetCard title="At-risk students" loading />}>
              <AtRiskList
                atRisk={atRiskWidget}
                schoolSlug={schoolSlugDisplay}
                schoolId={school.id}
              />
            </Suspense>
          )}

          {/* Today's classes — hybrid only */}
          {canSeeWidget('todaysClasses', ctx) && (
            <Suspense fallback={<WidgetCard title="Today's classes" loading />}>
              <TodaysClassesCard
                todaysClasses={{ status: 'unavailable' }}
                teacherView={role === 'teacher'}
              />
            </Suspense>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Teacher workload — leads the right column (v3) */}
          {canSeeWidget('teacherWorkload', ctx) && (
            <Suspense fallback={<WidgetCard title="Teacher workload" loading />}>
              <TeacherWorkloadWidget
                teacherWorkload={teacherWorkloadWidget}
                schoolSlug={schoolSlugDisplay}
              />
            </Suspense>
          )}

          {/* Quick actions */}
          <QuickActions role={role} schoolSlug={schoolSlugDisplay} />

          {/* Review queue — owner, full state */}
          {canSeeWidget('reviewQueue', ctx) && (
            <Suspense fallback={<WidgetCard title="Needs your review" loading />}>
              <ReviewQueueCard reviewQueue={{ status: 'unavailable' }} />
            </Suspense>
          )}

          {/* Teacher grading queue */}
          {canSeeWidget('teacherQueue', ctx) && (
            <TeacherQueueCard items={[]} loading={false} />
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
