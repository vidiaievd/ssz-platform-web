// ─── Analytics service response shapes ────────────────────────────────────────

export type KpiTrend = 'up' | 'down' | 'flat';

export type Kpi = {
  key: string;
  label: string;
  value: number;
  delta?: string | null;
  trend?: KpiTrend | null;
  hint?: string;
  /** The numbers inside `hint` (analytics, live check of plan 90): enrolled / courses / days. */
  hintValues?: Record<string, number>;
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
  /** The event behind the row; absent from an older analytics image. */
  eventType?: string;
};

export type ActivityPayload = {
  items: ActivityItem[];
  nextCursor: string | null;
};

// ─── Groups (organization reading; «today's classes» uses its facts) ──────────

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

/** A school group as «today's classes» reads it: name and head count (organization-service). */
export type SchoolGroupFacts = Pick<GroupHealthItem, 'id' | 'name' | 'studentCount' | 'max'>;

// ─── BFF composite response ────────────────────────────────────────────────────

export type GroupGap = {
  groupId: string;
  name: string;
  courseId: string | null;
  courseTitle: string | null;
  students: number;
  /** Whole percent of the course taught. `null` — the timetable could not be asked. */
  delivered: number | null;
  /** Whole percent the group's median learner took away. `null` — nobody measured. */
  absorbed: number | null;
  state: 'ok' | 'noCourse' | 'noAttempts';
};

export type GroupGapsPayload = {
  groups: GroupGap[];
  updatedAt: string;
};

export type Unavailable = { status: 'unavailable' };

// ─── School sessions (scheduling-service, API response shape) ──────────────────

/** One dated session of `GET scheduling/schools/:id/sessions` — only the fields the dashboard reads. */
export type SchoolSessionItem = {
  id: string;
  groupId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock `HH:MM`, as the school set it. */
  startTime: string;
  endTime: string;
  teacherId: string | null;
  room: string | null;
  status: 'scheduled' | 'moved' | 'cancelled' | 'held';
};

