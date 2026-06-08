import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${id}/students/${userId}/nudge`,
      method: 'POST',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to send nudge' }, { status: 502 });
  }
}
