import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

// Backend returns PaginatedResult<TagResponseDto>
type TagResponseDto = { id: string; name: string; slug: string };
type PaginatedTags = { items: TagResponseDto[] };

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') ?? '';

  try {
    // The backend exposes GET /api/v1/tags with a `search` param for full-text
    // filtering — use it as the autocomplete/suggestions source (first 10 results).
    const data = await serverFetch<PaginatedTags>({
      service: 'content',
      path: '/api/v1/tags',
      query: { search: q || undefined, limit: 10, page: 1 },
    });
    const names = (data?.items ?? []).map((t) => t.name);
    return NextResponse.json(names);
  } catch {
    // Suggestions are best-effort; return empty array on failure
    return NextResponse.json([]);
  }
}
