import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

// The exercise pool of one grammar rule: what the review queue draws on, and what an
// author attaches an exercise to.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) query[key] = value;

  try {
    const data = await serverFetch<unknown>({
      service: 'content',
      path: `/grammar-rules/${id}/pool`,
      query,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch the exercise pool' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { exerciseId?: string; weight?: number };

  if (typeof body.exerciseId !== 'string' || body.exerciseId === '') {
    return NextResponse.json({ error: 'exerciseId is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<{ entryId: string }>({
      service: 'content',
      path: `/grammar-rules/${id}/pool`,
      method: 'POST',
      body: { exerciseId: body.exerciseId, weight: body.weight },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // The exercise is already in this rule's pool — a unique constraint, not a failure the
    // author needs to fix; the panel reconciles by refetching.
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Already in the pool' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add to the pool' }, { status: 502 });
  }
}
