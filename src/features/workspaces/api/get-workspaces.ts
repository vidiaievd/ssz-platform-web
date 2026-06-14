import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import type { School } from '@/features/school/types';
import type { UserRolesResponse } from '@/lib/api/generated/schemas';
import type { WorkspaceContext, WorkspacesResponse } from '../types';
import { STAFF_ROLES } from '../types';

type SchoolsPayload =
  | School[]
  | { items: School[] }
  | { schools: School[] }
  | { data: School[] };

function extractSchools(payload: SchoolsPayload): School[] {
  if (Array.isArray(payload)) return payload;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('schools' in payload && Array.isArray(payload.schools)) return payload.schools;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export const getWorkspaces = cache(async function (): Promise<WorkspacesResponse> {
  const token = await readAccessToken();
  if (!token) return { contexts: [], lastActiveContextKey: null };

  const [schoolsResult, tutorGroupResult, rolesResult] = await Promise.allSettled([
    serverFetch<SchoolsPayload>({ service: 'organization', path: '/schools' }),
    serverFetch<{ id: string; name: string } | null>({ service: 'organization', path: '/tutoring/group' }),
    serverFetch<UserRolesResponse>({ service: 'auth', path: '/auth/roles' }),
  ]);

  const roles =
    rolesResult.status === 'fulfilled' ? (rolesResult.value.roles ?? []) : [];

  const contexts: WorkspaceContext[] = [];

  if (schoolsResult.status === 'fulfilled') {
    for (const school of extractSchools(schoolsResult.value)) {
      const role = school.myRole ?? null;
      if (!role || !STAFF_ROLES.includes(role)) continue;
      contexts.push({
        type: 'school',
        schoolId: school.id,
        schoolName: school.name,
        schoolSlug: school.slug ?? school.id,
        schoolAvatarUrl: school.avatarUrl ?? null,
        role,
        capabilities: school.myCapabilities ?? [],
      });
    }
  }

  // Private tutor — only global role 'tutor' AND an existing tutoring group
  if (
    roles.includes('tutor') &&
    tutorGroupResult.status === 'fulfilled' &&
    tutorGroupResult.value?.id
  ) {
    contexts.push({
      type: 'private_tutor',
      tutorGroupId: tutorGroupResult.value.id,
      tutorGroupName: tutorGroupResult.value.name ?? 'Private tutor',
    });
  }

  if (roles.includes('student')) {
    contexts.push({ type: 'student' });
  }

  const jar = await cookies();
  const lastKey = jar.get('last-workspace')?.value ?? null;

  return { contexts, lastActiveContextKey: lastKey };
});
