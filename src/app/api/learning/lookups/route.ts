import { NextRequest, NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';

/** Mirrors the service-side cap (spec 18 §5.1) so an oversized batch is rejected here, not upstream. */
const MAX_LOOKUPS = 50;

interface LookupBody {
  lessonId?: unknown;
  lessonVariantId?: unknown;
  vocabularyItemId?: unknown;
  level?: unknown;
  occurredAt?: unknown;
}

function isValidLookup(lookup: LookupBody): boolean {
  return (
    typeof lookup.lessonId === 'string' &&
    typeof lookup.lessonVariantId === 'string' &&
    typeof lookup.vocabularyItemId === 'string' &&
    (lookup.level === 'preview' || lookup.level === 'full') &&
    typeof lookup.occurredAt === 'string'
  );
}

/**
 * Word-card openings, batched by `LookupTelemetryProvider`.
 *
 * Answers 202 and never a body: the client ignores the response, and telemetry
 * must not be able to surface an error in a reading session. `srsState` is
 * deliberately absent from the request — learning-service resolves it from the
 * caller's own cards rather than trusting a client-held cache.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const lookups = (body as { lookups?: unknown })?.lookups;
  if (!Array.isArray(lookups) || lookups.length === 0) {
    return NextResponse.json({ error: '"lookups" must be a non-empty array' }, { status: 400 });
  }
  if (lookups.length > MAX_LOOKUPS) {
    return NextResponse.json({ error: `At most ${MAX_LOOKUPS} lookups per request` }, { status: 400 });
  }
  if (!lookups.every((lookup) => isValidLookup(lookup as LookupBody))) {
    return NextResponse.json({ error: 'Malformed lookup entry' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'progress',
      path: '/lookups',
      method: 'POST',
      body: { lookups },
    });
    return new NextResponse(null, { status: 202 });
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'rate_limited' ? 429 : e.code === 'unauthenticated' ? 401 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to record lookups' }, { status: 502 });
  }
}
