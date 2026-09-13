import { NextRequest, NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';
import { getContainerPreflight } from '@/features/content-authoring/lib/get-container-preflight';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') ?? '';

  try {
    const result = await getContainerPreflight(workspaceId, id);
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e) && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to run preflight' }, { status: 502 });
  }
}
