import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { seatsExhaustedResponseBody } from '@/features/school-seats/lib/seats-error';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // 200 { seats } when a learner took a seat; 204 from older backends.
    const result = await serverFetch<{ seats?: unknown } | undefined>({
      service: 'organization',
      path: `/schools/${id}/members`,
      method: 'POST',
      body,
    });
    return result ? NextResponse.json({ seats: result.seats ?? null }) : new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const exhausted = seatsExhaustedResponseBody(e);
    if (exhausted) return NextResponse.json(exhausted, { status: 409 });
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add member' }, { status: 502 });
  }
}
