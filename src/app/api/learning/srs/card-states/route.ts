import { NextRequest, NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { SrsCardStatesResponse, SrsContentType } from '@/features/learning/types';

type CardStatesBody = {
  contentType?: SrsContentType;
  contentIds?: string[];
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { contentType, contentIds } = body as CardStatesBody;
  if (!contentType || !Array.isArray(contentIds)) {
    return NextResponse.json(
      { error: '"contentType" and "contentIds" are required' },
      { status: 400 },
    );
  }

  try {
    const result = await serverFetch<SrsCardStatesResponse>({
      service: 'progress',
      path: '/srs/cards/states',
      method: 'POST',
      body: { contentType, contentIds },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'rate_limited' ? 429 : e.code === 'unauthenticated' ? 401 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to fetch card states' }, { status: 502 });
  }
}
