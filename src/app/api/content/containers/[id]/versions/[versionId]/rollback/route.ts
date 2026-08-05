import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;

  try {
    const result = await serverFetch<{ versionId: string }>({
      service: 'content',
      path: `/containers/${id}/versions/${versionId}/rollback`,
      method: 'POST',
    });
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      // The version is a draft, or already the live one.
      if (e.code === 'validation')
        return NextResponse.json({ error: 'Version cannot be restored' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to restore version' }, { status: 502 });
  }
}
