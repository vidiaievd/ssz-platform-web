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
 * Grammar rules the group's work was most often flagged on (platform plan 85, step 11).
 *
 * The same two checks as the heatmap beside it: a role with no business seeing named
 * results is refused, and a teacher may only read a group they teach.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;

  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  const [role, viewer] = await Promise.all([getMySchoolRole(id), getCurrentUser()]);
  if (!role || !viewer || !canSeePersonalResults(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (role === 'TEACHER') {
    const group = await getGroup(schoolId, groupId);
    const teaches = group?.teachers?.some((teacher) => teacher.userId === viewer.userId) ?? false;
    if (!teaches) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  const window = req.nextUrl.searchParams.get('window') ?? '30';
  try {
    const data = await serverFetch({
      service: 'analytics',
      path: `/analytics/groups/${groupId}/weak-rules?window=${encodeURIComponent(window)}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch weak rules' }, { status: 502 });
  }
}
