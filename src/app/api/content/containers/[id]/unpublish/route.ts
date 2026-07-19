import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await serverFetch({
      service: 'content',
      path: `/containers/${id}/unpublish`,
      method: 'POST',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (e.code === 'validation') return NextResponse.json({ error: 'Course has no published version' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to unpublish course' }, { status: 502 });
  }
}
