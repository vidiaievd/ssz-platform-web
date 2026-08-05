import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;

  try {
    // Upstream returns 204 No Content — there's no asset payload to relay.
    await serverFetch({
      service: 'media',
      path: `/media/uploads/${assetId}/finalize`,
      method: 'POST',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to finalize upload' }, { status: 502 });
  }
}
