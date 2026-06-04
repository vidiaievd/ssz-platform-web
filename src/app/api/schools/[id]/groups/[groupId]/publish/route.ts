import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, groupId } = await params;
  try {
    const data = await serverFetch({
      service: 'organization',
      path: `/schools/${id}/groups/${groupId}/publish`,
      method: 'POST',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json(e.details ?? { error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to publish group' }, { status: 502 });
  }
}
