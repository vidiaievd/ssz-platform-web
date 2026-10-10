import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * One synthesized word as an exercise asset of its own — the TTS button of the `minimal_pairs`
 * builder (plan 72 §3.5). Unlike `/media/pronunciation`, the answer is an asset id, not a URL:
 * the document keeps the id, and the length arrives on the asset once the worker has measured it.
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
      path: '/media/pronunciation/clip',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'validation') {
      // `LANGUAGE_NOT_SUPPORTED`, a text piper refuses, a malformed exercise id.
      return NextResponse.json({ error: 'Cannot synthesize that text' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to synthesize the clip' }, { status: 502 });
  }
}
