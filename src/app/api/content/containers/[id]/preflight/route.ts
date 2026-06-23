import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { Container, ContainerItem } from '@/features/content/types';
import { runPreflight } from '@/features/content-authoring/lib/preflight';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const schoolSlug = _request.nextUrl.searchParams.get('schoolSlug') ?? '';

  try {
    const [container, itemsResp] = await Promise.all([
      serverFetch<Container>({ service: 'content', path: `/containers/${id}` }),
      serverFetch<{ items: ContainerItem[] }>({
        service: 'content',
        path: `/containers/${id}/versions`,
        query: { limit: '1' },
      }),
    ]);

    const result = runPreflight(schoolSlug, container, itemsResp.items ?? []);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to run preflight' }, { status: 502 });
  }
}
