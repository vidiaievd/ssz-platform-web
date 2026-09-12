import { type NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getGroup } from '@/features/groups/api/queries';
import { canSeePersonalResults } from '@/features/groups/lib/can-manage';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; groupId: string }> };

/**
 * Screen B's data — every learner of the group against every unit.
 *
 * Two checks, and both live here rather than upstream (plan 58 §2 F). A teacher may only
 * read a group they teach, and a role with no business seeing named results is refused
 * outright: this route carries one row per learner, so it is the strictest of the pair.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;

  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  const [role, viewer] = await Promise.all([getMySchoolRole(id), getCurrentUser()]);
  if (!role || !viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // The schedule is built from hours and rooms; who is struggling is none of its business.
  if (!canSeePersonalResults(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (role === 'TEACHER') {
    const group = await getGroup(schoolId, groupId);
    const teaches = group?.teachers?.some((teacher) => teacher.userId === viewer.userId) ?? false;
    if (!teaches) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  try {
    const data = await serverFetch({
      service: 'analytics',
      path: `/analytics/groups/${groupId}/heatmap`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch group heatmap' }, { status: 502 });
  }
}
