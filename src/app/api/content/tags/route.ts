import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ContentTag } from '@/features/content/types';
import { tagEntitySegment } from '@/features/content-authoring/lib/tag-entity';

/** The tags on one entity: `?entityType=container&entityId=<id>`. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const segment = entityType ? tagEntitySegment(entityType) : null;

  if (!segment || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<ContentTag[]>({
      service: 'content',
      path: `/${segment}/${entityId}/tags`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 502 });
  }
}
