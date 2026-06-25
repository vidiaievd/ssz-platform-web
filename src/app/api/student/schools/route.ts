import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getStudentSchools } from '@/features/student/api/get-student-schools';

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.userId) return NextResponse.json([], { status: 200 });

  try {
    const schools = await getStudentSchools(user.userId);
    return NextResponse.json(schools);
  } catch (e) {
    console.error('[student/schools] failed:', e);
    return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 502 });
  }
}
