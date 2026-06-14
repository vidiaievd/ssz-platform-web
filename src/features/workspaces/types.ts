import type { SchoolRole } from '@/features/school/types';

export type { SchoolRole };

export type WorkspaceContext =
  | {
      type: 'school';
      schoolId: string;
      schoolName: string;
      schoolSlug: string;
      schoolAvatarUrl: string | null;
      role: SchoolRole;
      capabilities: string[];
    }
  | {
      type: 'private_tutor';
      tutorGroupId: string;
      tutorGroupName: string;
    }
  | {
      type: 'student';
    };

export type WorkspacesResponse = {
  contexts: WorkspaceContext[];
  lastActiveContextKey: string | null;
};

/** Stable context key — stored in last-workspace cookie */
export function toContextKey(ctx: WorkspaceContext): string {
  if (ctx.type === 'school') return `school:${ctx.schoolId}`;
  if (ctx.type === 'private_tutor') return 'private_tutor';
  return 'student';
}

export const STAFF_ROLES: SchoolRole[] = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'TEACHER',
  'CONTENT_ADMIN',
  'SCHEDULER',
];
