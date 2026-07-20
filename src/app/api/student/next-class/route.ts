import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getNextClass } from '@/features/student/api/get-next-class';

/**
 * The student's soonest scheduled class, or `null` when there is none. This
 * powers a single Home card, so every failure mode — unauthenticated, no
 * membership, scheduling-service down — resolves to `null` with a 200 rather
 * than an error the Home screen would have to handle.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.userId) return NextResponse.json(null, { status: 200 });

  try {
    return NextResponse.json(await getNextClass(user.userId));
  } catch (e) {
    console.error('[student/next-class] failed:', e);
    return NextResponse.json(null, { status: 200 });
  }
}
