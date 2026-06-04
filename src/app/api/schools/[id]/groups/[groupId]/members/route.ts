import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/groups/${groupId}/members`,
    });
    return NextResponse.json(data);
  } catch (e) {
    return handleError(e, 'Failed to fetch members');
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  const override = req.nextUrl.searchParams.get('override') === 'true';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/groups/${groupId}/members`,
      method: 'POST',
      query: override ? { override: true } : undefined,
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return handleError(e, 'Failed to add members');
  }
}

function handleError(e: unknown, fallback: string) {
  if (e instanceof AppError && e.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (e instanceof AppError && e.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof AppError && e.code === 'conflict') {
    return NextResponse.json(e.details ?? { error: e.message }, { status: 409 });
  }
  return NextResponse.json({ error: fallback }, { status: 502 });
}
