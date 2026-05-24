import { NextResponse } from 'next/server';

// Unpublish (published → draft) is pending backend support.
// The Content Service currently only supports publish; a separate
// "unpublish" transition endpoint has not been added yet.
export async function POST() {
  return NextResponse.json(
    { error: 'not_implemented', detail: 'Unpublish endpoint is pending backend support.' },
    { status: 501 },
  );
}
