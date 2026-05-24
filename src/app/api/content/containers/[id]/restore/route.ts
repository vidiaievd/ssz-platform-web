import { NextResponse } from 'next/server';

// Restore (archived → previous state) is pending backend support.
export async function POST() {
  return NextResponse.json(
    { error: 'not_implemented', detail: 'Restore endpoint is pending backend support.' },
    { status: 501 },
  );
}
