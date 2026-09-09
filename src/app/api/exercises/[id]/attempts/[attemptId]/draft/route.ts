import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { DraftResponse, SaveDraftResponse } from '@/features/student/exercises/types/attempts';

/**
 * The work in progress, on the way to the engine and back.
 *
 * This is the only answer state the browser is not the sole keeper of. Everywhere else a
 * half-finished exercise is a handful of placements the learner can redo in a minute, so
 * it lives in `localStorage` and nobody minds losing it. A written text is not that: two
 * hundred words are an evening, and a closed tab, a flat battery or a browser that
 * cleared its storage must not cost them (plan 50, phase 2).
 *
 * Nothing here is validated or scored. The draft is stored exactly as it arrives —
 * a save refused because half a sentence does not parse is precisely the failure this
 * endpoint exists to prevent — and submitting reads the submit request, never this.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { draftAnswer } = body as { draftAnswer?: unknown };
  if (draftAnswer === undefined) {
    return NextResponse.json({ error: '"draftAnswer" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<SaveDraftResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/draft`,
      method: 'PUT',
      body: { draftAnswer },
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(errorFor(e), { status: statusFor(e) });
  }
}

/**
 * The draft back, and nothing else off the attempt.
 *
 * The attempt record the engine answers with holds the submitted answer and the
 * validator's reading of it; on a graded attempt the latter can be the answer key in
 * long form. Only the two draft fields are forwarded — they are the learner's own
 * unfinished text, which nothing but their own client ever wrote.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  try {
    const attempt = await serverFetch<{ draftAnswer?: unknown; draftSavedAt?: string | null }>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}`,
      method: 'GET',
    });
    return NextResponse.json({
      draftAnswer: attempt.draftAnswer ?? null,
      draftSavedAt: attempt.draftSavedAt ?? null,
    } satisfies DraftResponse);
  } catch (e) {
    return NextResponse.json(errorFor(e), { status: statusFor(e) });
  }
}

function statusFor(e: unknown): number {
  if (isAppError(e)) {
    if (e.code === 'unauthenticated') return 401;
    if (e.code === 'forbidden') return 403;
    if (e.code === 'not_found') return 404;
    // The attempt is no longer in progress — handed in, or abandoned. Not an error to
    // retry: there is nothing left to save into.
    if (e.code === 'validation') return 422;
  }
  return 502;
}

function errorFor(e: unknown): { error: string } {
  if (isAppError(e)) {
    if (e.code === 'unauthenticated') return { error: 'Unauthorized' };
    if (e.code === 'forbidden') return { error: 'Not your attempt' };
    if (e.code === 'not_found') return { error: 'Attempt not found' };
    if (e.code === 'validation') return { error: 'This attempt is no longer in progress' };
  }
  return { error: 'Draft request failed' };
}
