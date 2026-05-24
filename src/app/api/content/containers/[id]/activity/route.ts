import { NextResponse } from 'next/server';

// The Content Service does not expose a container audit-log endpoint yet.
// Returns an empty feed so the activity section renders gracefully.
export async function GET() {
  return NextResponse.json({ events: [], hasMore: false });
}
