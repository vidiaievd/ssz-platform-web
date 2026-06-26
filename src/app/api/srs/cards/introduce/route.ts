import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';

type IntroduceCardBody = {
  contentType?: 'EXERCISE' | 'VOCABULARY_WORD';
  contentId?: string;
  seedKind?: 'DIAGNOSTIC_KNOWN' | 'CLAIMED_KNOWN';
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { contentType, contentId, seedKind } = body as IntroduceCardBody;
  if (!contentType || !contentId) {
    return NextResponse.json(
      { error: '"contentType" and "contentId" are required' },
      { status: 400 },
    );
  }

  try {
    const result = await serverFetch({
      service: 'progress',
      path: '/srs/cards/introduce',
      method: 'POST',
      body: { contentType, contentId, seedKind },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'rate_limited' ? 429 : e.code === 'unauthenticated' ? 401 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to introduce card' }, { status: 502 });
  }
}
