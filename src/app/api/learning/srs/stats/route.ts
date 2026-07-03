import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { SrsStats } from '@/features/learning/types';

export async function GET() {
  try {
    const data = await serverFetch<SrsStats>({
      service: 'progress',
      path: '/srs/stats',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch SRS stats' }, { status: 502 });
  }
}
