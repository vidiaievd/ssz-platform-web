import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

import { atomErrorResponse } from '../errors';

type Params = { params: Promise<{ id: string; atomId: string }> };

/**
 * Rename an atom, re-word it, or move it to the other track.
 *
 * The key can be changed here: a learner's cards and an exercise's targets address the atom
 * by id, so a rename costs nothing — only a seed keyed on the old slug notices, and it
 * notices by creating a second atom rather than by failing.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, atomId } = await params;
  const body = (await request.json()) as {
    key?: string;
    title?: string;
    description?: string | null;
    track?: string;
  };

  if (body.track !== undefined && body.track !== 'lexis' && body.track !== 'grammar') {
    return NextResponse.json({ error: 'track must be lexis or grammar' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${id}/atoms/${atomId}`,
      method: 'PATCH',
      body: {
        ...(body.key !== undefined ? { key: body.key } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description ?? '' } : {}),
        ...(body.track !== undefined ? { track: body.track } : {}),
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'key_taken' }, { status: 409 });
    }
    return atomErrorResponse(e, 'Failed to update the atom');
  }
}

/** Retire an atom. Soft — what it has already proved about a learner stays behind it. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, atomId } = await params;

  try {
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${id}/atoms/${atomId}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return atomErrorResponse(e, 'Failed to retire the atom');
  }
}
