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
  'students',
  'teachers',
  'analytics',
  'branding',
  'permissions',
  'moderation',
  'settings',
];

const TEACHER_NAV: NavId[] = ['dashboard', 'courses', 'students'];
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

const OWNER_KPI_KEYS: Kpi['key'][] = [
  'active_students_7d',
  'lessons_completed_7d',
  'pending_reviews',
  'at_risk',
];

const ADMIN_KPI_KEYS: Kpi['key'][] = OWNER_KPI_KEYS;

const TEACHER_KPI_KEYS: Kpi['key'][] = [
  'active_students_7d',
  'lessons_completed_7d',
  'pending_reviews', // teacher sees own review queue, not owner's
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
  { id: 'new-course', labelKey: 'Dashboard.school.actions.newCourse', icon: 'BookPlus', href: '#' },
  {
    id: 'invite-teacher',
    labelKey: 'Dashboard.school.actions.inviteTeacher',
    icon: 'UserPlus',
    href: '#',
  },
  {
    id: 'enroll-student',
    labelKey: 'Dashboard.school.actions.enrollStudent',
    icon: 'GraduationCap',
    href: '#',
  },
  {
    id: 'import-csv',
    labelKey: 'Dashboard.school.actions.importCsv',
    icon: 'Upload',
    href: '#',
  },
  {
    id: 'edit-branding',
    labelKey: 'Dashboard.school.actions.editBranding',
    icon: 'Palette',
    href: '#',
  },
  {
    id: 'monthly-report',
    labelKey: 'Dashboard.school.actions.monthlyReport',
    icon: 'FileBarChart',
    href: '#',
  },
];

const ADMIN_ACTIONS: QuickAction[] = OWNER_ACTIONS.filter((a) => a.id !== 'edit-branding');

const TEACHER_ACTIONS: QuickAction[] = [
  { id: 'new-lesson', labelKey: 'Dashboard.school.actions.newLesson', icon: 'FilePlus', href: '#' },
  {
    id: 'schedule-class',
    labelKey: 'Dashboard.school.actions.scheduleClass',
    icon: 'CalendarPlus',
    href: '#',
  },
  {
    id: 'grade-queue',
    labelKey: 'Dashboard.school.actions.gradeQueue',
    icon: 'ClipboardCheck',
    href: '#',
  },
  {
    id: 'message-class',
    labelKey: 'Dashboard.school.actions.messageClass',
    icon: 'MessageSquare',
    href: '#',
  },
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

  switch (widget) {
    case 'kpis':
      return true;

    case 'activity':
      return dataState !== 'empty';

    case 'courseHealth':
      return (role === 'owner' || role === 'admin') && dataState === 'full';

    case 'atRisk':
      return (role === 'owner' || role === 'admin') && dataState !== 'empty';

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
