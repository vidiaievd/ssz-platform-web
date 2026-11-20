import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMyHistory } from '@/features/student/api/get-my-history';

/** Finished courses of the student, read only — see `getMyHistory`. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.userId) return NextResponse.json([], { status: 200 });

  try {
    return NextResponse.json(await getMyHistory());
  } catch (e) {
    console.error('[student/my-history] failed:', e);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 502 });
  }
}
