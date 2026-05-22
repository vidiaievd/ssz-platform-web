import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { PaginatedResponse, Container } from '@/features/content/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }

  try {
    const data = await serverFetch<PaginatedResponse<Container>>({
      service: 'content',
      path: '/api/v1/containers',
      query,
      anonymous: false,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ items: [], pageInfo: { hasNextPage: false } });
    }
    return NextResponse.json({ error: 'Failed to fetch containers' }, { status: 502 });
  }
}
