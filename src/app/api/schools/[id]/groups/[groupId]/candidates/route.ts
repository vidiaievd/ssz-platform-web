import { type NextRequest, NextResponse } from 'next/server';

import { getStudentCandidates } from '@/features/groups/api/queries';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 404 });
  const data = await getStudentCandidates(schoolId, groupId);
  return NextResponse.json(data);
}
