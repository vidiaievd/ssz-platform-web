import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { ContainerActivity } from '@/features/content-authoring/types';

/**
 * Who changed this course and the material it places.
 *
 * Actor ids come back unresolved: content-service holds no user directory, so
 * names are a separate join the caller makes.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limit = request.nextUrl.searchParams.get('limit');
  const before = request.nextUrl.searchParams.get('before');

  try {
    const activity = await serverFetch<ContainerActivity>({
      service: 'content',
      path: `/containers/${id}/activity`,
      query: {
        ...(limit ? { limit } : {}),
        ...(before ? { before } : {}),
      },
    });
    return NextResponse.json(activity);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 502 });
  }
}
