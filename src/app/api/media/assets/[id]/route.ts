import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const data = await serverFetch({
      service: 'media',
      path: `/media/assets/${id}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: statusOf(e) });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await serverFetch({
      service: 'media',
      path: `/media/assets/${id}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: statusOf(e) });
  }
}

/**
 * The upstream's refusal, kept. Everything used to come back as 502, so a gateway rate limit
 * (503 from nginx, with every learner behind the one BFF address) read as a broken media
 * service — plan 76, 2.2. Only what is truly unknown stays 502.
 */
function statusOf(error: unknown): number {
  if (!(error instanceof AppError)) return 502;
  if (error.code === 'unauthenticated') return 401;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'rate_limited') return 429;
  if (error.code === 'upstream_unavailable') return 503;
  return 502;
}
