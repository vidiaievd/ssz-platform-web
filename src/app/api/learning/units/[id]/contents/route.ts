import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { UnitContentsResult } from '@/features/learning/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const contents = await serverFetch<UnitContentsResult>({
      service: 'progress',
      path: `/progress/units/${encodeURIComponent(id)}/contents`,
    });
    return NextResponse.json(contents);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load unit contents' }, { status: 502 });
  }
}
