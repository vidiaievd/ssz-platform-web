import { NextResponse } from 'next/server';

// Archive is not yet supported by the Content Service backend.
// This route returns 501 so the danger zone UI can be wired now and
// connected to the real endpoint when the backend ships it.
export async function POST() {
  return NextResponse.json(
    { error: 'not_implemented', detail: 'Archive endpoint is pending backend support.' },
    { status: 501 },
  );
}
