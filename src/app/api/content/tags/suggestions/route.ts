import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

type TagResponseDto = { id: string; name: string };
type PaginatedTags = { items: TagResponseDto[] };

/**
 * Tags an author may put on a material: the platform's global ones plus, with `schoolId`, the
 * school's own (content-service answers exactly that set to a non-admin without a scope).
 * `?q=` filters by name. Best effort: a failure is an empty list.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') ?? '';
  const schoolId = searchParams.get('schoolId');

  try {
    const data = await serverFetch<PaginatedTags>({
      service: 'content',
      path: '/tags',
      query: { search: q || undefined, schoolId: schoolId || undefined, limit: 10, page: 1 },
    });
    return NextResponse.json((data?.items ?? []).map(({ id, name }) => ({ id, name })));
  } catch {
    return NextResponse.json([]);
  }
}
