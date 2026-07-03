import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { SrsDueResponse } from '@/features/learning/types';

export async function GET() {
  try {
    const data = await serverFetch<SrsDueResponse>({
      service: 'progress',
      path: '/srs/due',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'rate_limited') return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to fetch SRS queue' }, { status: 502 });
  }
}
