import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
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

  const { to } = body as { to?: MembershipStatus };
  if (!to) {
    return NextResponse.json({ error: '"to" status is required' }, { status: 400 });
  }

  try {
    const provider = getEnrollmentProvider();
    // provider.transition re-validates the transition via canTransition; 409 on invalid
    const updated = await provider.transition(membershipId, to);
    return NextResponse.json(updated);
  } catch (e) {
    if (isAppError(e)) {
      const status =
        e.code === 'conflict' ? 409
        : e.code === 'not_found' ? 404
        : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to transition membership' }, { status: 502 });
  }
}
