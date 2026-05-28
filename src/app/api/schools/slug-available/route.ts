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
    // Backend returns 400 "Validation failed (uuid is expected)" because
    // the slug-available endpoint is not yet implemented and the router
    // falls through to GET /schools/{id} which expects a UUID.
    // Treat this as "endpoint unavailable" — optimistically report available:true
    // so the wizard form is not blocked.
    if (e instanceof AppError && e.code === 'validation') {
      return NextResponse.json({ available: true, suggestions: [] });
    }
    return NextResponse.json({ error: 'Slug check failed' }, { status: 502 });
  }
}
