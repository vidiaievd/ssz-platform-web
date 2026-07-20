import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { SrsCard, SrsDueResponse } from '@/features/learning/types';

/** Shape learning-service actually returns — it has no `dueCount` field. */
interface UpstreamDueCardsEnvelope {
  cards: SrsCard[];
  reviewedToday: number;
  dailyLimit: number;
}

export async function GET() {
  try {
    const upstream = await serverFetch<UpstreamDueCardsEnvelope>({
      service: 'progress',
      path: '/srs/due',
    });
    // dueCount has no upstream equivalent — the cards array is the queue itself.
    const data: SrsDueResponse = { ...upstream, dueCount: upstream.cards.length };
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'rate_limited') return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to fetch SRS queue' }, { status: 502 });
  }
}
