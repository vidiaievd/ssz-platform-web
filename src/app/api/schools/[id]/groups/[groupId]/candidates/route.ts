import { type NextRequest, NextResponse } from 'next/server';

import { getStudentCandidates } from '@/features/groups/api/queries';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  const data = await getStudentCandidates(id, groupId);
  return NextResponse.json(data);
}
