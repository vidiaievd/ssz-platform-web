import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get('entityType');
  const q = searchParams.get('q') ?? '';

  if (!entityType) {
    return NextResponse.json({ error: 'entityType is required' }, { status: 400 });
  }

  try {
    const query = new URLSearchParams({ entityType });
    if (q) query.set('q', q);
    const data = await serverFetch<string[]>({
      service: 'content',
      path: `/api/v1/tags/suggestions?${query}`,
    });
    return NextResponse.json(data);
  } catch {
    // Suggestions are best-effort; return empty array on failure
    return NextResponse.json([]);
  }
}
