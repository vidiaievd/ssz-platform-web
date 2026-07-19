import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

import { toFeShape, type BackendItemFull } from '../map-vocabulary-item';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> },
) {
  const { listId, itemId } = await params;

  try {
    const data = await serverFetch<BackendItemFull>({
      service: 'content',
      path: `/vocabulary-lists/${listId}/items/${itemId}`,
    });
    return NextResponse.json(toFeShape(data));
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch vocabulary item' }, { status: 502 });
  }
}
