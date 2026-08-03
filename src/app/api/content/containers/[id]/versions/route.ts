import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { ContainerVersion } from '@/features/content/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const resp = await serverFetch<{ items: ContainerVersion[] }>({
      service: 'content',
      path: `/containers/${id}/versions`,
      // The version history reads this list; the upstream default page of 20
      // would silently truncate it on a course with a long release record.
      query: { limit: 50 },
    });
    return NextResponse.json(resp.items ?? []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 502 });
  }
}
