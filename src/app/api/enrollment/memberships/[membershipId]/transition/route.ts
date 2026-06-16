import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { MembershipStatus } from '@/features/enrollment/types';

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

  const { schoolId, to } = body as { schoolId?: string; to?: MembershipStatus };

  if (!schoolId) return NextResponse.json({ error: '"schoolId" is required' }, { status: 400 });
  if (!to) return NextResponse.json({ error: '"to" status is required' }, { status: 400 });

  // Map explicit admin transitions to backend endpoints.
  // Student-initiated post-onboarding transitions (→ placement-review, → active) are driven
  // by the backend as side-effects of availability/placement submission — no explicit call needed.
  let backendPath: string | null = null;
  if (to === 'onboarding') backendPath = `/schools/${schoolId}/memberships/${membershipId}/approve`;
  if (to === 'rejected') backendPath = `/schools/${schoolId}/memberships/${membershipId}/reject`;

  if (!backendPath) {
    return NextResponse.json({ ok: true });
  }

  try {
    await serverFetch({ service: 'organization', path: backendPath, method: 'POST' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAppError(e)) {
      const status =
        e.code === 'conflict' ? 409 : e.code === 'not_found' ? 404 : e.code === 'forbidden' ? 403 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to transition membership' }, { status: 502 });
  }
}
