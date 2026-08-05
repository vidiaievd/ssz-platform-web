import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import type { Container } from '@/features/content/types';
import { attachPublishStates } from '@/features/content-authoring/lib/attach-publish-states';

interface UpstreamPaginatedContainers {
  items: Container[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * `pageInfo` is added on top of the upstream shape (rather than replacing
 * it) so callers that already read the native `total`/`page`/`totalPages`
 * fields directly (e.g. use-my-containers.ts) keep working unchanged, while
 * useContainers.ts's infinite-query cursor pagination gets what it expects.
 */
function withPageInfo(data: UpstreamPaginatedContainers) {
  return {
    ...data,
    pageInfo: {
      total: data.total,
      hasNextPage: data.page < data.totalPages,
      nextCursor: data.page < data.totalPages ? String(data.page + 1) : undefined,
    },
  };
}

const EMPTY_RESPONSE = { items: [], total: 0, pageInfo: { hasNextPage: false, total: 0 } };

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }

  // The "my containers" UI sends scope=owned — the backend has no such concept,
  // it filters by explicit ownerUserId instead.
  const ownedScope = query.scope === 'owned';

  if (ownedScope) {
    delete query.scope;
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json(EMPTY_RESPONSE);
    }
    query.ownerUserId = user.userId;
  } else if (query.scope === 'public') {
    // Same story — "public" is the catalogue's own concept, the backend
    // filters by `visibility` instead.
    delete query.scope;
    query.visibility = 'public';
  } else {
    // 'enrolled' | 'all' (or unset): the backend query DTO whitelists its
    // fields strictly and 400s on an unrecognized `scope` key, so it must not
    // be forwarded even when there's nothing useful to translate it to — the
    // backend's own auth scoping already limits results to what the caller may see.
    delete query.scope;
  }

  // useContainers.ts speaks `level`/`type`/`cursor`; the backend's native
  // field names are `difficultyLevel`/`containerType`/`page`. Callers that
  // already send the native names (use-my-containers.ts) are untouched.
  if (query.level && !query.difficultyLevel) {
    query.difficultyLevel = query.level;
  }
  delete query.level;
  if (query.type && !query.containerType) {
    query.containerType = query.type;
  }
  delete query.type;
  if (query.cursor && !query.page) {
    query.page = query.cursor;
  }
  delete query.cursor;

  try {
    const data = await serverFetch<UpstreamPaginatedContainers>({
      service: 'content',
      path: '/containers',
      query,
      anonymous: false,
    });

    // Only for the author's own list: whether something is waiting to be
    // released is their concern, and it costs a second call the public
    // catalogue has no use for.
    const items = ownedScope ? await attachPublishStates(data.items) : data.items;

    return NextResponse.json(withPageInfo({ ...data, items }));
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json(EMPTY_RESPONSE);
    }
    return NextResponse.json({ error: 'Failed to fetch containers' }, { status: 502 });
  }
}
