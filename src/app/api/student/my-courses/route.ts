import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMyCourses } from '@/features/student/api/get-my-courses';

/**
 * Every course the student has access to — school-group materials, their own
 * enrollments, and anything they have progress on — with progress as an
 * overlay rather than a filter.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.userId) return NextResponse.json([], { status: 200 });

  try {
    return NextResponse.json(await getMyCourses(user.userId));
  } catch (e) {
    console.error('[student/my-courses] failed:', e);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 502 });
  }
}
