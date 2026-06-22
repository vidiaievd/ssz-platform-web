import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { AgeBand } from '@/features/groups/types';

const AGE_BANDS: AgeBand[] = ['kids', 'teens', 'adults'];

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

  const { schoolId, ageBand } = body as { schoolId?: string; ageBand?: AgeBand };

  if (!schoolId) return NextResponse.json({ error: '"schoolId" is required' }, { status: 400 });
  if (!ageBand || !AGE_BANDS.includes(ageBand)) {
    return NextResponse.json({ error: '"ageBand" must be one of kids, teens, adults' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/memberships/${membershipId}/age-band`,
      method: 'POST',
      body: { ageBand },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'not_found' ? 404 : e.code === 'forbidden' ? 403 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to submit age band' }, { status: 502 });
  }
}
