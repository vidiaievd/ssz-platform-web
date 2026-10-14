import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/** The lesson asset this one replaced, while it can still be restored (plan 74, D5). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const data = await serverFetch({ service: 'media', path: `/media/assets/${id}/previous` });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'No previous asset' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch the previous asset' }, { status: 502 });
  }
}
