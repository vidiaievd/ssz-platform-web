import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { MembershipStatus } from '@/features/enrollment/types';

type AdminTransition = 'onboarding' | 'rejected';
type StudentTransition = 'active' | 'placement-review';

function mapError(e: unknown) {
  if (isAppError(e)) {
    const status =
      e.code === 'conflict' ? 409
      : e.code === 'not_found' ? 404
      : e.code === 'forbidden' ? 403
      : 502;
    return NextResponse.json({ error: e.message }, { status });
  }
  return NextResponse.json({ error: 'Failed to transition membership' }, { status: 502 });
}

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

  // Admin-initiated transitions
  const adminPaths: Partial<Record<AdminTransition, string>> = {
    onboarding: `/schools/${schoolId}/memberships/${membershipId}/approve`,
    rejected: `/schools/${schoolId}/memberships/${membershipId}/reject`,
  };

  if (to in adminPaths) {
    try {
      await serverFetch({ service: 'organization', path: adminPaths[to as AdminTransition]!, method: 'POST' });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return mapError(e);
    }
  }

  // Student-initiated transition: onboarding → active | placement-review
  const studentTransitions = new Set<StudentTransition>(['active', 'placement-review']);
  if (studentTransitions.has(to as StudentTransition)) {
    try {
      await serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/memberships/${membershipId}/complete`,
        method: 'POST',
        body: { to },
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return mapError(e);
    }
  }

  return NextResponse.json({ error: `Unsupported transition: ${to}` }, { status: 400 });
}
