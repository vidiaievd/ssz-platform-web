// ─── Analytics service response shapes ────────────────────────────────────────

export type KpiTrend = 'up' | 'down' | 'flat';

export type Kpi = {
  key: string;
  label: string;
  value: number;
  delta?: string | null;
  trend?: KpiTrend | null;
  hint?: string;
  spark?: number[];
  sub?: string;
};

export type KpisPayload = {
  role: string;
  kpis: Kpi[];
};

export type AtRiskStudent = {
  userId: string;
  name: string;
  course?: string;
  lastSeen?: string | null;
  progress: number;
  lang?: string;
};

export type AtRiskPayload = {
  students: AtRiskStudent[];
  total: number;
};

export type CourseHealth = {
  courseId: string;
  name: string;
  lang: string;
  enrollment: number;
  completion: number;
  trend: KpiTrend;
  dropoff?: boolean;
};

export type CourseHealthPayload = {
  courses: CourseHealth[];
};

export type ActivityItem = {
  id: string;
  who?: string | null;
  what: string;
  target?: string | null;
  occurredAt: string;
  tag: 'people' | 'content' | 'review' | 'milestone';
};

export type ActivityPayload = {
  items: ActivityItem[];
  nextCursor: string | null;
};

// ─── Groups health (API response shape) ───────────────────────────────────────

export type GroupAlert = {
  type: string;
  severity: string;
  label: string;
};

export type GroupHealthItem = {
  id: string;
  name: string;
  lang: string;
  level: string;
  primaryTeacherName: string | null;
  studentCount: number;
  max: number;
  alerts: GroupAlert[];
};

export type GroupsHealthPayload = {
  activeCount: number;
  groups: GroupHealthItem[];
  attentionCount: number;
};

// ─── Teacher workload (API response shape) ─────────────────────────────────────

export type TeacherLoadItem = {
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
};

export type TeacherLoadPayload = {
  overloadedCount: number;
  avgLoadPct: number;
  conflictCount: number;
  teachers: TeacherLoadItem[];
};

// ─── BFF composite response ────────────────────────────────────────────────────

export type Unavailable = { status: 'unavailable' };

export type DashboardCompositeResponse = {
  schoolId: string;
  role: string;
  kpis: KpisPayload | Unavailable;
  atRisk: AtRiskPayload | Unavailable;
  courseHealth: CourseHealthPayload | Unavailable;
  activity: ActivityPayload | Unavailable;
  /** Out of scope — scheduling service not yet built. */
  todaysClasses: Unavailable;
  /** Out of scope — billing service not yet built. */
  trial: Unavailable;
  onboarding: {
    items: Array<{ key: string; done: boolean; labelKey: string; est: string; href: string }>;
    completed: number;
    total: number;
    minutesLeft: number;
  };
  dataState: 'empty' | 'partial' | 'full';
  schoolType: 'online' | 'hybrid';
};
