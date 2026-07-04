import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getStudentSchool } from '@/features/student/api/get-student-schools';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolSlug: string }> },
) {
  const { schoolSlug } = await params;

  const user = await getCurrentUser();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  try {
    const school = await getStudentSchool(user.userId, schoolSlug);
    if (!school) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(school);
  } catch (e) {
    console.error('[student/schools/:schoolSlug] failed:', e);
    return NextResponse.json({ error: 'Failed to fetch school' }, { status: 502 });
  }
}
