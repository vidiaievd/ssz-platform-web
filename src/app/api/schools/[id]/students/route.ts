import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const query: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) query[k] = v;

  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/students`,
      query,
    });
    return NextResponse.json(data);
  } catch (e) {
    return handleError(e, 'Failed to fetch students');
  }
}

/** POST — enroll student (branching handled in server action; BFF proxies to invitations or members) */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/invitations`,
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return handleError(e, 'Failed to enroll student');
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
