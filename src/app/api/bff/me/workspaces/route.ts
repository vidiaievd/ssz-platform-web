import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import type { School } from '@/features/school/types';
import type { WorkspaceContext, WorkspacesResponse } from '@/features/workspaces/types';
import { STAFF_ROLES } from '@/features/workspaces/types';
import type { UserRolesResponse } from '@/lib/api/generated/schemas';

const LAST_WORKSPACE_COOKIE = 'last-workspace';

// ── GET /api/bff/me/workspaces ─────────────────────────────────────────────

export async function GET() {
  const token = await readAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  type SchoolsPayload = School[] | { items: School[] } | { schools: School[] } | { data: School[] };

  const [schoolsResult, tutorGroupResult, rolesResult] = await Promise.allSettled([
    serverFetch<SchoolsPayload>({ service: 'organization', path: '/schools' }),
    serverFetch<{ id: string; name: string } | null>({ service: 'organization', path: '/tutoring/group' }),
    serverFetch<UserRolesResponse>({ service: 'auth', path: '/auth/roles' }),
  ]);

  const roles =
    rolesResult.status === 'fulfilled' ? (rolesResult.value.roles ?? []) : [];

  const contexts: WorkspaceContext[] = [];

  // 1. School contexts — only non-STUDENT roles
  if (schoolsResult.status === 'fulfilled') {
    const raw = schoolsResult.value;
    const schools: School[] = Array.isArray(raw)
      ? raw
      : 'items' in raw
        ? raw.items
        : 'schools' in raw
          ? raw.schools
          : 'data' in raw
            ? raw.data
            : [];

    for (const school of schools) {
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

  // 2. Private tutor — only global role 'tutor' AND an existing tutoring group
  // (GET /tutoring/group returns 404 when no group exists → allSettled catches as rejected)
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

  // 3. Student context
  if (roles.includes('student')) {
    contexts.push({ type: 'student' });
  }

  const jar = await cookies();
  const lastKey = jar.get(LAST_WORKSPACE_COOKIE)?.value ?? null;

  const body: WorkspacesResponse = { contexts, lastActiveContextKey: lastKey };
  return NextResponse.json(body);
}

// ── POST /api/bff/me/workspaces/activate ──────────────────────────────────
// Note: activate lives in a sub-route file (activate/route.ts)
// This file handles only GET for /api/bff/me/workspaces.

