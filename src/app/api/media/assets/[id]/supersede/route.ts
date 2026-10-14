import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * Mark a lesson asset as replaced by another (plan 74, D5). Nothing is deleted: the old asset
 * stays playable and restorable for the retention period.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'media',
      path: `/media/assets/${id}/supersede`,
      method: 'POST',
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (e instanceof AppError && (e.code === 'forbidden' || e.code === 'validation')) {
      return NextResponse.json({ error: 'Cannot replace that asset' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to replace the asset' }, { status: 502 });
  }
}
