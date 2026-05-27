import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { GrammarRule, PaginatedResponse } from '@/features/content/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }

  try {
    const data = await serverFetch<PaginatedResponse<GrammarRule>>({
      service: 'content',
      path: '/grammar-rules',
      query,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ items: [], pageInfo: { hasNextPage: false } });
    }
    return NextResponse.json({ error: 'Failed to fetch grammar rules' }, { status: 502 });
  }
}
