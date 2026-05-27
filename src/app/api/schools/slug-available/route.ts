import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug || slug.trim().length < 3) {
    return NextResponse.json({ available: null, suggestions: [] });
  }

  try {
    const data = await serverFetch({
      service: 'organization',
      path: '/schools/slug-available',
      query: { slug: slug.trim() },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Slug check failed' }, { status: 502 });
  }
}
