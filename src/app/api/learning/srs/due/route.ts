import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { SrsCard, SrsDueResponse, SrsStats } from '@/features/learning/types';

/** Envelope learning-service returns — it has no `dueCount` field. */
interface UpstreamDueCardsEnvelope {
  cards: SrsCard[];
  reviewedToday: number;
  dailyLimit: number;
  streakDays: number;
}

/** Matches the server's `limit` cap. */
const MAX_CARDS = 100;
const DEFAULT_CARDS = 20;

export async function GET(request: NextRequest) {
  const limitParam = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_CARDS)
    : DEFAULT_CARDS;
  // Translation preference for the resolved word content; the server falls
  // back to another language and flags it via `back.fallbackUsed`.
  const language = request.nextUrl.searchParams.get('language') ?? 'en';

  try {
    // `/srs/due` returns a bounded sample, so the true backlog has to come
    // from `/srs/stats/me` — using `cards.length` under-reports it as soon as
    // the user has more due cards than `limit`.
    const [upstream, stats] = await Promise.all([
      serverFetch<UpstreamDueCardsEnvelope>({
        service: 'progress',
        path: '/srs/due',
        query: { limit, language, includeExamples: true },
      }),
      serverFetch<SrsStats>({ service: 'progress', path: '/srs/stats/me' }),
    ]);

    const data: SrsDueResponse = { ...upstream, dueCount: stats.dueNowCount };
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'rate_limited') return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to fetch SRS queue' }, { status: 502 });
  }
}
