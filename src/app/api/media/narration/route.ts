import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * Narrate a lesson body with speech synthesis (plan 74). The answer is immediate — an asset id
 * that turns READY once spoken and processed; the editor polls the asset like an upload.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'media',
      path: '/media/narration',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 202 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Only lesson authors can narrate' }, { status: 403 });
    }
    if (e instanceof AppError && e.code === 'validation') {
      // `EMPTY_TEXT`, `TEXT_TOO_LONG` or `LANGUAGE_NOT_SUPPORTED` — the editor names each one.
      const reason = (e.details as { message?: unknown } | null)?.message;
      return NextResponse.json(
        { error: 'Cannot narrate that text', reason: typeof reason === 'string' ? reason : null },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'Failed to request the narration' }, { status: 502 });
  }
}
