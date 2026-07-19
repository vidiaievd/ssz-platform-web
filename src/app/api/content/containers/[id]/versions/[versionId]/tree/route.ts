import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { CurriculumTree } from '@/features/content/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;

  try {
    const tree = await serverFetch<CurriculumTree>({
      service: 'content',
      path: `/containers/${id}/versions/${versionId}/tree`,
    });
    return NextResponse.json(tree);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch curriculum tree' }, { status: 502 });
  }
}
