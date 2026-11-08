import 'server-only';

import { NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';

import { serverFetch, type ServerFetchOptions } from './server-fetcher';

/** A take is one speech call and, on a miss, one explanation: seconds, not minutes. */
export const SOUND_SESSION_TIMEOUT_MS = 60_000;

/** Statuses the pronunciation session answers on purpose; none of them is a fault. */
const EXPECTED = [400, 403, 404, 409, 422, 503];

/** What a client may learn from a refusal: its code and the numbers it acts on, never the prose. */
function refusalOf(details: unknown): { code?: string; retryAfterMs?: number | null; takeIndex?: number } {
  if (typeof details !== 'object' || details === null) return {};
  const d = details as Record<string, unknown>;
  return {
    ...(typeof d.code === 'string' ? { code: d.code } : {}),
    ...(typeof d.retryAfterMs === 'number' || d.retryAfterMs === null ? { retryAfterMs: d.retryAfterMs as number | null } : {}),
    ...(typeof d.takeIndex === 'number' ? { takeIndex: d.takeIndex } : {}),
  };
}

const STATUS_OF: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation: 422,
  upstream_unavailable: 503,
};

/**
 * One call to the pronunciation session (platform plan 86, step 13.4/14.1), passed through with
 * the engine's own refusal code (`SESSION_LIMIT`, `POOL_EMPTY`, `NOT_AVAILABLE`, `STALE_TAKE`,
 * `SESSION_CLOSED`, …) so the screen can say what happened and not just that it failed. The
 * engine owns every decision; this only keeps the status and the code.
 */
export async function soundSessionCall(
  opts: Pick<ServerFetchOptions, 'service' | 'path' | 'method' | 'query' | 'body'>,
): Promise<NextResponse> {
  try {
    const data = await serverFetch({
      ...opts,
      timeoutMs: SOUND_SESSION_TIMEOUT_MS,
      expectedErrorStatuses: EXPECTED,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const status = STATUS_OF[e.code];
      if (status !== undefined) {
        return NextResponse.json({ error: 'Refused', ...refusalOf(e.details) }, { status });
      }
    }
    return NextResponse.json({ error: 'Could not reach the pronunciation session' }, { status: 502 });
  }
}
