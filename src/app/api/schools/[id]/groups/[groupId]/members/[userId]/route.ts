import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';

type Params = { params: Promise<{ id: string; groupId: string; userId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, groupId, userId } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 404 });
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/groups/${groupId}/members/${userId}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 502 });
  }
}
