export type DashboardRole = 'owner' | 'admin' | 'teacher' | 'editor';
export type DataState = 'empty' | 'partial' | 'full';
export type SchoolType = 'online' | 'hybrid';
export type Trend = 'up' | 'down' | 'flat';

// Degradation wrapper — uniform across all widgets (spec §8).
export type WidgetData<T> =
  | { status: 'ok'; data: T }
  | { status: 'empty' }
  | { status: 'unavailable'; reason?: string };

// ── Operations alerts ─────────────────────────────────────────────────────────
export type AlertType = 'no-primary' | 'conflict' | 'overload' | 'over' | 'under';
export type AlertSeverity = 'danger' | 'warn';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  label: string;
}

// ── Groups health (dashboard view model) ──────────────────────────────────────
export interface GroupHealth {
  id: string;
  name: string;
  lang: string;
  level: string;
  primaryTeacherName: string | null;
  studentCount: number;
  max: number;
  alerts: Alert[];
}

export interface GroupsHealthData {
  activeCount: number;
  attentionCount: number;
  groups: GroupHealth[];
}

// ── Teacher workload (dashboard view model) ───────────────────────────────────
export interface TeacherLoad {
  id: string;
  name: string;
  avatarUrl?: string | null;
  hours: number;
  max: number;
  pct: number;
  overloaded: boolean;
  groups: number;
  langs?: string[];
  conflicts: number;
}

export interface TeacherWorkloadData {
  overloadedCount: number;
  avgLoadPct: number;
  conflictCount: number;
  teachers: TeacherLoad[];
}

export interface Kpi {
  key:
    // owner / admin — operations-weighted
    | 'active_groups'
    | 'active_students_7d'
    | 'avg_teacher_load'
    | 'scheduling_conflicts'
    // teacher — personal view
    | 'my_groups'
    | 'my_students'
    | 'lessons_per_week'
    | 'my_load'
    // legacy (kept for backwards-compat with analytics service)
    | 'lessons_completed_7d'
    | 'pending_reviews'
    | 'at_risk';
  value: number | '—';
  delta?: string;
  trend?: Trend;
  hint?: string;
  spark?: number[];
  sub?: string;
  locked?: boolean;
}

export interface ActivityItem {
  id: string;
  who: string;
  what: string;
  target: string;
  time: string; // ISO — formatted client-side
  iconKey: 'check' | 'user' | 'flag' | 'star' | 'book';
  tone: 'success' | 'primary' | 'warning' | 'neutral';
  tag?: 'people' | 'content' | 'review' | 'milestone';
}

export interface CourseHealthRow {
  id: string;
  name: string;
  lang: string;
  students: number;
  completion: number;
  trend: Trend;
  flag?: 'dropoff' | null;
}

export interface AtRiskStudent {
  userId: string;
  name: string;
  course: string;
  lastSeen: string;
  progress: number;
  lang: string;
}

export interface ReviewQueueItem {
  id: string;
  kind: 'lesson' | 'rubric';
  title: string;
  author: string;
  age: string;
}

export interface TodaysClass {
  id: string;
  time: string;
  name: string;
  teacher?: string;
  room: string;
  mode: 'online' | 'in-person';
  students: number;
  cap: number;
  status: 'now' | 'upcoming' | 'low';
}

export interface OnboardingItem {
  key: string;
  done: boolean;
  labelKey: string;
  est: string;
  href: string;
}

export interface OnboardingState {
  items: OnboardingItem[];
  completed: number;
  total: number;
  minutesLeft: number;
}

export interface DashboardData {
  schoolId: string;
  role: DashboardRole;
  dataState: DataState;
  schoolType: SchoolType;
  trial: { daysLeft: number } | null;
  kpis: WidgetData<Kpi[]>;
  groupsHealth: WidgetData<GroupsHealthData>;
  teacherWorkload: WidgetData<TeacherWorkloadData>;
  activity: WidgetData<ActivityItem[]>;
  courseHealth: WidgetData<CourseHealthRow[]>;
  atRisk: WidgetData<{ students: AtRiskStudent[]; total: number }>;
  reviewQueue: WidgetData<ReviewQueueItem[]>;
  todaysClasses: WidgetData<TodaysClass[]>;
  onboarding: OnboardingState;
}

// Nav IDs used across sidebar and role gating
export type NavId =
  | 'dashboard'
  | 'courses'
  | 'groups'
  | 'students'
  | 'teachers'
  | 'scheduling'
  | 'invitations'
  | 'analytics'
  | 'branding'
  | 'permissions'
  | 'moderation'
  | 'settings';

export type WidgetId =
  | 'kpis'
  | 'operationsBanner'
  | 'groupsWidget'
  | 'teacherWorkload'
  | 'activity'
  | 'courseHealth'
  | 'atRisk'
  | 'reviewQueue'
  | 'todaysClasses'
  | 'onboarding'
  | 'trialBanner'
  | 'teacherQueue'
  | 'tipCard';

export interface QuickAction {
  id: string;
  labelKey: string;
  icon: string;
  href?: string;
  action?: string;
}
