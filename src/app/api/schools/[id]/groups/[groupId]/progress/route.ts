import { type NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getGroup } from '@/features/groups/api/queries';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import type { SchoolRole } from '@/features/school/types';

type Params = { params: Promise<{ id: string; groupId: string }> };

/** Roles that see every group of their school. */
const SEES_EVERY_GROUP: readonly SchoolRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'];

/**
 * Screen A's data — group progress, delivered against absorbed.
 *
 * **"A teacher sees only their own groups" is enforced here, not in analytics**
 * (plan 58 §2 F). The analytics route guarantees membership of the group's school and no
 * more, because building a `GroupTeacher` projection for one rule would cost more than
 * checking it where the teacher roster is already loaded — which is exactly here. The
 * consequence is written down in the plan's risks: the upstream endpoint is softer than
 * this screen, so this check is the only thing standing between a teacher and a group
 * that is not theirs.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;

  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  const [role, viewer] = await Promise.all([getMySchoolRole(id), getCurrentUser()]);
  if (!role || !viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!SEES_EVERY_GROUP.includes(role)) {
    if (role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const group = await getGroup(schoolId, groupId);
    const teaches = group?.teachers?.some((teacher) => teacher.userId === viewer.userId) ?? false;
    // 404 rather than 403 for a group they do not teach: whether this school has such a
    // group is not something to confirm to somebody who may not look at it.
    if (!teaches) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  try {
    const data = await serverFetch({
      service: 'analytics',
      path: `/analytics/groups/${groupId}/progress`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    // Analytics being down empties one tab; it must not be reported as a group with
    // nothing in it, which is a claim about the group.
    return NextResponse.json({ error: 'Failed to fetch group progress' }, { status: 502 });
  }
}
