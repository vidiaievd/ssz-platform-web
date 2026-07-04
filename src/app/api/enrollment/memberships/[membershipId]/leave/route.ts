import { NextResponse } from 'next/server';

// TODO(plan 19 / F2): organization-service has no `active -> left` membership
// command yet (only the roster-level `DELETE :schoolId/members/:userId`, which
// doesn't touch the enrollment state machine). Wire this once that command
// exists; until then the confirm dialog surfaces this as a known limitation.
export async function POST() {
  return NextResponse.json(
    { error: 'Leaving a school is not implemented yet' },
    { status: 501 },
  );
}
