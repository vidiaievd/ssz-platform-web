import { NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';

/** The engine's refusals, as the screens tell them apart. Shared by `GET` and `dispute`. */
export function refusal(e: unknown, fallback: string): NextResponse {
  if (isAppError(e)) {
    if (e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e.code === 'not_found' && codeOf(e.details) === 'NO_AI_REVIEW') {
      return NextResponse.json(
        { error: 'No model reviewed this submission', code: 'NO_AI_REVIEW' },
        { status: 404 },
      );
    }
    // Someone else's attempt reads as one that is not there, as on the verdict route.
    if (e.code === 'not_found' || e.code === 'forbidden') {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (e.code === 'validation') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  }
  return NextResponse.json({ error: fallback }, { status: 502 });
}

function codeOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { code } = details as { code?: unknown };
  return typeof code === 'string' ? code : null;
}
