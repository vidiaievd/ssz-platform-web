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
  hasPublishedLesson: boolean;
  hasPendingInvitation: boolean;
};

const ONBOARDING_ITEMS_EST = {
  'create-course': '5 min',
  'invite-teacher': '2 min',
  'fill-branding': '5 min',
  'invite-students': '3 min',
  'publish-lesson': '10 min',
} as const satisfies Record<string, string>;

function onboardingEst(key: string): string {
  return (ONBOARDING_ITEMS_EST as Record<string, string | undefined>)[key] ?? '0 min';
}

export function computeOnboarding(input: OnboardingInput): OnboardingState {
  const {
    school,
    membersCount,
    coursesCount,
    hasPublishedLesson,
    hasPendingInvitation,
  } = input;

  const items: OnboardingItem[] = [
    {
      key: 'create-course',
      done: coursesCount > 0,
      labelKey: 'Dashboard.school.onboarding.createCourse',
      est: onboardingEst('create-course'),
      href: '#courses/new',
    },
    {
      key: 'invite-teacher',
      done: membersCount > 1 || hasPendingInvitation,
      labelKey: 'Dashboard.school.onboarding.inviteTeacher',
      est: onboardingEst('invite-teacher'),
      href: '#members/invite',
    },
    {
      key: 'fill-branding',
      done: Boolean(school.avatarUrl && school.description),
      labelKey: 'Dashboard.school.onboarding.fillBranding',
      est: onboardingEst('fill-branding'),
      href: '#settings/branding',
    },
    {
      key: 'invite-students',
      done: membersCount > 2,
      labelKey: 'Dashboard.school.onboarding.inviteStudents',
      est: onboardingEst('invite-students'),
      href: '#students/invite',
    },
    {
      key: 'publish-lesson',
      done: hasPublishedLesson,
      labelKey: 'Dashboard.school.onboarding.publishLesson',
      est: onboardingEst('publish-lesson'),
      href: '#courses',
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const remaining = items.filter((i) => !i.done);
  const minutesLeft = remaining.reduce((acc, item) => {
    const mins = parseInt(onboardingEst(item.key), 10);
    return acc + mins;
  }, 0);

  return { items, completed, total: items.length, minutesLeft };
}
