import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { schoolId } = body as { schoolId?: string };

  if (!schoolId) return NextResponse.json({ error: '"schoolId" is required' }, { status: 400 });

  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/memberships/${membershipId}/mark-group-assigned-seen`,
      method: 'POST',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'not_found' ? 404 : e.code === 'forbidden' ? 403 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to mark banner as seen' }, { status: 502 });
  }
}
