import type {
  DashboardRole,
  DataState,
  Kpi,
  NavId,
  QuickAction,
  SchoolType,
  WidgetId,
} from '../types';

// ─── Nav gating ──────────────────────────────────────────────────────────────

const ALL_NAV: NavId[] = [
  'dashboard',
  'courses',
  'groups',
  'students',
  'teachers',
  'scheduling',
  'invitations',
  'analytics',
  'branding',
  'permissions',
  'moderation',
  'settings',
];

// teacher can see their own cohorts + timetable via Groups
const TEACHER_NAV: NavId[] = ['dashboard', 'courses', 'groups', 'students'];
const EDITOR_NAV: NavId[] = ['courses', 'moderation'];

export function navGating(role: DashboardRole): Record<NavId, 'enabled' | 'locked'> {
  const enabled = new Set<NavId>(
    role === 'teacher' ? TEACHER_NAV : role === 'editor' ? EDITOR_NAV : ALL_NAV,
  );
  return Object.fromEntries(
    ALL_NAV.map((id) => [id, enabled.has(id) ? 'enabled' : 'locked']),
  ) as Record<NavId, 'enabled' | 'locked'>;
}

// ─── KPI set ─────────────────────────────────────────────────────────────────

// v3: operations-weighted KPIs for owner/admin (spec §5, KpiCard)
const OWNER_KPI_KEYS: Kpi['key'][] = [
  'active_groups',
  'active_students_7d',
  'avg_teacher_load',
  'scheduling_conflicts',
];

const ADMIN_KPI_KEYS: Kpi['key'][] = OWNER_KPI_KEYS;

// teacher sees their own workload
const TEACHER_KPI_KEYS: Kpi['key'][] = [
  'my_groups',
  'my_students',
  'lessons_per_week',
  'my_load',
];

const EDITOR_KPI_KEYS: Kpi['key'][] = ['lessons_completed_7d', 'pending_reviews'];

export function kpiSetFor(role: DashboardRole): Kpi['key'][] {
  switch (role) {
    case 'owner':
      return OWNER_KPI_KEYS;
    case 'admin':
      return ADMIN_KPI_KEYS;
    case 'teacher':
      return TEACHER_KPI_KEYS;
    case 'editor':
      return EDITOR_KPI_KEYS;
  }
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const OWNER_ACTIONS: QuickAction[] = [
  { id: 'new-course',         labelKey: 'Dashboard.school.actions.newCourse',       icon: 'BookPlus',     href: '#' },
  { id: 'new-group',          labelKey: 'Dashboard.school.actions.newGroup',        icon: 'Layers',       href: '#' },
  { id: 'invite-teacher',     labelKey: 'Dashboard.school.actions.inviteTeacher',   icon: 'UserPlus',     href: '#' },
  { id: 'enroll-student',     labelKey: 'Dashboard.school.actions.enrollStudent',   icon: 'GraduationCap',href: '#' },
  { id: 'teacher-timetable',  labelKey: 'Dashboard.school.actions.teacherTimetable',icon: 'CalendarDays', href: '#' },
  { id: 'monthly-report',     labelKey: 'Dashboard.school.actions.monthlyReport',   icon: 'FileBarChart', href: '#' },
];

const ADMIN_ACTIONS: QuickAction[] = OWNER_ACTIONS;

const TEACHER_ACTIONS: QuickAction[] = [
  { id: 'new-lesson',     labelKey: 'Dashboard.school.actions.newLesson',     icon: 'FilePlus',     href: '#' },
  { id: 'my-groups',      labelKey: 'Dashboard.school.actions.myGroups',      icon: 'Layers',       href: '#' },
  { id: 'my-timetable',   labelKey: 'Dashboard.school.actions.myTimetable',   icon: 'CalendarDays', href: '#' },
  { id: 'grade-queue',    labelKey: 'Dashboard.school.actions.gradeQueue',    icon: 'ClipboardCheck',href: '#' },
];

export function quickActionsFor(role: DashboardRole): QuickAction[] {
  switch (role) {
    case 'owner':
      return OWNER_ACTIONS;
    case 'admin':
      return ADMIN_ACTIONS;
    case 'teacher':
      return TEACHER_ACTIONS;
    case 'editor':
      return [];
  }
}

// ─── Widget visibility ────────────────────────────────────────────────────────

export function canSeeWidget(
  widget: WidgetId,
  ctx: { role: DashboardRole; dataState: DataState; schoolType: SchoolType },
): boolean {
  const { role, dataState, schoolType } = ctx;
  const isAdmin = role === 'owner' || role === 'admin';

  switch (widget) {
    case 'kpis':
      return true;

    // Non-dismissible operations banner — admins only, full state, only when issues exist
    // (visibility here = "can potentially show"; actual render checks counts)
    case 'operationsBanner':
      return isAdmin && dataState === 'full';

    // Groups widget — admins see school-wide attention list; teachers see own groups
    case 'groupsWidget':
      return role !== 'editor' && dataState !== 'empty';

    // Teacher workload — admins only (teacher sees own KPIs instead)
    case 'teacherWorkload':
      return isAdmin && dataState !== 'empty';

    case 'activity':
      return dataState !== 'empty';

    case 'courseHealth':
      return isAdmin && dataState === 'full';

    case 'atRisk':
      return isAdmin && dataState !== 'empty';

    case 'reviewQueue':
      return role === 'owner' && dataState === 'full';

    case 'todaysClasses':
      return schoolType === 'hybrid' && dataState !== 'empty';

    case 'onboarding':
      return role !== 'editor' && dataState !== 'full';

    case 'trialBanner':
      return role === 'owner';

    case 'teacherQueue':
      return role === 'teacher';

    case 'tipCard':
      return dataState !== 'empty';
  }
}
