import { NextResponse } from 'next/server';

// Duplicate (creates a draft copy) is pending backend support.
export async function POST() {
  return NextResponse.json(
    { error: 'not_implemented', detail: 'Duplicate endpoint is pending backend support.' },
    { status: 501 },
  );
}
