import { type NextRequest, NextResponse } from 'next/server';

import { getSchoolStudents } from '@/features/groups/api/queries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const data = await getSchoolStudents(id);
  return NextResponse.json(data);
}
