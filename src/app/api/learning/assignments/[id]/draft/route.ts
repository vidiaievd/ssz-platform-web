import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { WrittenDraftRequest } from '@/features/learning/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text } = body as WrittenDraftRequest;
  if (typeof text !== 'string') {
    return NextResponse.json({ error: '"text" is required' }, { status: 400 });
  }

  try {
    await serverFetch<void>({
      service: 'progress',
      path: `/assignments/${id}/draft`,
      method: 'PUT',
      body: { text },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 502 });
  }
}
