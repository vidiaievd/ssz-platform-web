import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/students/${userId}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    return handleError(e, 'Failed to fetch student');
  }
}

function handleError(e: unknown, fallback: string) {
  if (e instanceof AppError && e.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (e instanceof AppError && e.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof AppError && e.code === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: fallback }, { status: 502 });
}
