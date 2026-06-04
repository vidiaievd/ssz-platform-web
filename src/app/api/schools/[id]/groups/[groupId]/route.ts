import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/groups/${groupId}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    return handleError(e, 'Failed to fetch group');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/groups/${groupId}`,
      method: 'PATCH',
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    return handleError(e, 'Failed to update group');
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${id}/groups/${groupId}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleError(e, 'Failed to delete group');
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
  if (e instanceof AppError && e.code === 'conflict') {
    return NextResponse.json(e.details ?? { error: e.message }, { status: 409 });
  }
  return NextResponse.json({ error: fallback }, { status: 502 });
}
