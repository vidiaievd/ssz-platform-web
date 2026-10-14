import { NextResponse } from 'next/server';

import { isAppError, type AppErrorCode } from '@/lib/errors';

const STATUS: Partial<Record<AppErrorCode, number>> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation: 422,
  rate_limited: 429,
};

/**
 * The upstream refusal as the client should see it: the status, and content-service's own
 * code (INVALID_SURFACE_FORM, CATALOG_WORD_READ_ONLY…) as `error`, which the UI branches on.
 */
export function errorResponse(e: unknown, fallback: string): NextResponse {
  if (isAppError(e)) {
    const upstream = (e.details as { message?: unknown } | null)?.message;
    return NextResponse.json(
      { error: typeof upstream === 'string' ? upstream : e.message, code: e.code },
      { status: STATUS[e.code] ?? 502 },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 502 });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
