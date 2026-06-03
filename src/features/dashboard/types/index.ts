export type DashboardRole = 'owner' | 'admin' | 'teacher' | 'editor';
export type DataState = 'empty' | 'partial' | 'full';
export type SchoolType = 'online' | 'hybrid';
export type Trend = 'up' | 'down' | 'flat';

// Degradation wrapper — uniform across all widgets (spec §8).
export type WidgetData<T> =
  | { status: 'ok'; data: T }
  | { status: 'empty' }
  | { status: 'unavailable'; reason?: string };

export interface Kpi {
  key: 'active_students_7d' | 'lessons_completed_7d' | 'pending_reviews' | 'at_risk';
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
  | 'students'
  | 'teachers'
  | 'analytics'
  | 'branding'
  | 'permissions'
  | 'moderation'
  | 'settings';

export type WidgetId =
  | 'kpis'
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
