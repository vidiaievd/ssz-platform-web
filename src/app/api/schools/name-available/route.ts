import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name || name.trim().length < 2) {
    return NextResponse.json({ available: null, suggestions: [] });
  }

  try {
    const data = await serverFetch({
      service: 'organization',
      path: '/api/v1/schools/name-available',
      query: { name: name.trim() },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Name check failed' }, { status: 502 });
  }
}
