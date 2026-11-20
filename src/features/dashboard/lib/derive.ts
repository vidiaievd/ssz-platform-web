import type { DataState, DashboardRole, OnboardingItem, OnboardingState, SchoolType } from '../types';
import type { SchoolRole } from '@/features/school/types';

// ─── School type ──────────────────────────────────────────────────────────────

type SchoolWithType = { type?: string | null };

export function deriveSchoolType(school: SchoolWithType): SchoolType {
  if (school.type === 'HYBRID') return 'hybrid';
  return 'online';
}

// ─── Data state ───────────────────────────────────────────────────────────────

type DataStateInput = {
  membersCount: number;
  coursesCount: number;
  hasActivity: boolean;
};

export function deriveDataState({ membersCount, coursesCount, hasActivity }: DataStateInput): DataState {
  const isNewSchool = coursesCount === 0 && membersCount <= 1;
  if (isNewSchool) return 'empty';
  if (coursesCount > 0 && membersCount > 1 && hasActivity) return 'full';
  return 'partial';
}

// ─── Per-school viewer role ───────────────────────────────────────────────────

type SchoolForRole = {
  ownerId?: string | null;
  members?: Array<{ userId: string; role?: SchoolRole }>;
};

const BACKEND_ROLE_MAP: Record<string, DashboardRole> = {
  OWNER: 'owner',
  ADMIN: 'admin',
  TEACHER: 'teacher',
  CONTENT_ADMIN: 'editor',
  // STUDENT is not a dashboard viewer role — treat as teacher (min access)
  STUDENT: 'teacher',
};

export function deriveViewerRole(
  school: SchoolForRole,
  viewerUserId: string,
): DashboardRole {
  if (school.ownerId && school.ownerId === viewerUserId) return 'owner';

  const membership = school.members?.find((m) => m.userId === viewerUserId);
  if (membership?.role) {
    const mapped = BACKEND_ROLE_MAP[membership.role];
    if (mapped) return mapped;
  }

  // Degrade to teacher (minimum dashboard access) when role cannot be resolved
  console.warn(
    `[dashboard] could not resolve role for user ${viewerUserId} in school — defaulting to teacher`,
  );
  return 'teacher';
}

// ─── Onboarding checklist ─────────────────────────────────────────────────────

type OnboardingInput = {
  school: {
    avatarUrl?: string | null;
    description?: string | null;
  };
  membersCount: number; // total members including owner
  coursesCount: number;
  groupsCount: number;
  hasPublishedLesson: boolean;
  hasPendingInvitation: boolean;
  hasAssignedTeacher: boolean; // any group with a primary teacher
};

const ONBOARDING_ITEMS_EST: Record<string, number> = {
  'fill-branding': 5,
  'create-course': 5,
  'create-group-schedule': 5,
  'invite-teacher': 2,
  'assign-teacher-group': 2,
  'invite-students': 3,
};

function onboardingEst(key: string): number {
  return ONBOARDING_ITEMS_EST[key] ?? 0;
}

export function computeOnboarding(input: OnboardingInput): OnboardingState {
  const {
    school,
    membersCount,
    coursesCount,
    groupsCount,
    hasPendingInvitation,
    hasAssignedTeacher,
  } = input;

  // 6-step path: logo → course → group+schedule → teacher → assign → students
  const items: OnboardingItem[] = [
    {
      key: 'fill-branding',
      done: Boolean(school.avatarUrl && school.description),
      labelKey: 'fillBranding',
      estMinutes: onboardingEst('fill-branding'),
      href: 'settings/school',
    },
    {
      key: 'create-course',
      done: coursesCount > 0,
      labelKey: 'createCourse',
      estMinutes: onboardingEst('create-course'),
      href: 'content/new',
    },
    {
      key: 'create-group-schedule',
      done: groupsCount > 0,
      labelKey: 'createGroupSchedule',
      estMinutes: onboardingEst('create-group-schedule'),
      href: 'groups/new',
    },
    {
      key: 'invite-teacher',
      done: membersCount > 1 || hasPendingInvitation,
      labelKey: 'inviteTeacher',
      estMinutes: onboardingEst('invite-teacher'),
      href: 'teachers',
    },
    {
      key: 'assign-teacher-group',
      done: hasAssignedTeacher,
      labelKey: 'assignTeacherGroup',
      estMinutes: onboardingEst('assign-teacher-group'),
      href: 'groups',
    },
    {
      key: 'invite-students',
      done: membersCount > 2,
      labelKey: 'inviteStudents',
      estMinutes: onboardingEst('invite-students'),
      href: 'students',
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const remaining = items.filter((i) => !i.done);
  const minutesLeft = remaining.reduce((acc, item) => acc + item.estMinutes, 0);

  return { items, completed, total: items.length, minutesLeft };
}
