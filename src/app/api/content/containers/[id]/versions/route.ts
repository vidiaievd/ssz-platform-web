import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { ContainerVersion } from '@/features/content/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const resp = await serverFetch<{ items: ContainerVersion[] }>({
      service: 'content',
      path: `/containers/${id}/versions`,
    });
    return NextResponse.json(resp.items ?? []);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 502 });
  }
}
