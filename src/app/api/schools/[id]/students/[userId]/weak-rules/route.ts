import { type NextRequest, NextResponse } from 'next/server';

import { canSeePersonalResults } from '@/features/groups/lib/can-manage';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * Grammar rules one learner's work was most often flagged on (platform plan 85, step 11).
 *
 * Gated like the learner's mastery tab it sits on: the roles that may see named results.
 * Which school the learner belongs to is analytics' to answer (a shared school, else 404).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id, userId } = await params;

  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  const role = await getMySchoolRole(id);
  if (!canSeePersonalResults(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const query = new URLSearchParams({ window: req.nextUrl.searchParams.get('window') ?? '30' });
  const courseId = req.nextUrl.searchParams.get('courseId');
  if (courseId) query.set('courseId', courseId);

  try {
    const data = await serverFetch({
      service: 'analytics',
      path: `/analytics/students/${userId}/weak-rules?${query.toString()}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch weak rules' }, { status: 502 });
  }
}
