import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

type Params = { params: Promise<{ id: string; exerciseId: string }> };

/** The weight of one entry: how often the review queue picks this exercise for the rule. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, exerciseId } = await params;
  const body = (await request.json()) as { weight?: number };

  if (typeof body.weight !== 'number' || !Number.isFinite(body.weight)) {
    return NextResponse.json({ error: 'weight is required' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${id}/pool/${exerciseId}`,
      method: 'PATCH',
      body: { weight: body.weight },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e, 'Failed to update the pool entry');
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, exerciseId } = await params;

  try {
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${id}/pool/${exerciseId}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e, 'Failed to remove from the pool');
  }
}

function errorResponse(e: unknown, message: string): NextResponse {
  if (e instanceof AppError && e.code === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (e instanceof AppError && e.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (e instanceof AppError && e.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ error: message }, { status: 502 });
}
