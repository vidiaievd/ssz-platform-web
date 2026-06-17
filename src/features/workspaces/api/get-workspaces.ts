import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import type { School } from '@/features/school/types';
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

  const [user, schoolsResult, tutorGroupResult] = await Promise.all([
    getCurrentUser(),
    serverFetch<SchoolsPayload>({ service: 'organization', path: '/schools' }).then(
      (v) => ({ status: 'fulfilled' as const, value: v }),
      () => ({ status: 'rejected' as const }),
    ),
    serverFetch<{ id: string; name: string } | null>({ service: 'organization', path: '/tutoring/group' }).then(
      (v) => ({ status: 'fulfilled' as const, value: v }),
      () => ({ status: 'rejected' as const }),
    ),
  ]);

  const roles = user?.roles ?? [];

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
