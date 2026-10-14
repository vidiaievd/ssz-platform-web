import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';

type BulkIntroduceBody = {
  vocabularyListId?: string;
  seedKind?: 'DIAGNOSTIC_KNOWN' | 'CLAIMED_KNOWN';
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { vocabularyListId, seedKind } = body as BulkIntroduceBody;
  if (!vocabularyListId) {
    return NextResponse.json({ error: '"vocabularyListId" is required' }, { status: 400 });
  }

  try {
    const result = await serverFetch({
      service: 'progress',
      path: '/srs/cards/bulk-introduce',
      method: 'POST',
      body: { vocabularyListId, seedKind },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'unauthenticated' ? 401 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to bulk-introduce vocabulary list' }, { status: 502 });
  }
}
