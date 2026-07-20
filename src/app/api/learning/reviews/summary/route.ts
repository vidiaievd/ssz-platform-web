import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getReviewsSummary } from '@/features/learning/api/get-reviews-summary';

/**
 * Due-review summary for the Reviews screen and the nav badge. A zero backlog
 * is a legitimate answer, not an error, so every failure mode resolves to an
 * empty summary — the badge disappears rather than the shell breaking.
 */
const EMPTY = {
  totalDue: 0,
  overdueCount: 0,
  byKind: { exercise: 0, vocabulary_word: 0 },
  breakdown: [],
  upcoming: [],
  unattributedDue: 0,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.userId) return NextResponse.json(EMPTY, { status: 200 });

  try {
    return NextResponse.json(await getReviewsSummary(user.userId));
  } catch (e) {
    console.error('[learning/reviews/summary] failed:', e);
    return NextResponse.json({ error: 'Failed to load review summary' }, { status: 502 });
  }
}
