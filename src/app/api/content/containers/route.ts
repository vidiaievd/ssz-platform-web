import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import type { Container } from '@/features/content/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }

  // The "my containers" UI sends scope=owned — the backend has no such concept,
  // it filters by explicit ownerUserId instead.
  if (query.scope === 'owned') {
    delete query.scope;
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ items: [], total: 0 });
    }
    query.ownerUserId = user.userId;
  }

  try {
    const data = await serverFetch<{ items: Container[]; total: number; page: number; limit: number; totalPages: number }>({
      service: 'content',
      path: '/containers',
      query,
      anonymous: false,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ items: [], total: 0 });
    }
    return NextResponse.json({ error: 'Failed to fetch containers' }, { status: 502 });
  }
}
