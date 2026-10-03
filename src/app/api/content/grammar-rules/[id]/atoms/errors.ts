import { NextResponse } from 'next/server';

import { AppError } from '@/lib/errors';

/** The statuses every atom route shares, mapped once. */
export function atomErrorResponse(e: unknown, message: string): NextResponse {
  if (e instanceof AppError && e.code === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (e instanceof AppError && e.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Already retired — the state the caller asked for, reached without them. Passing it
  // through as 410 lets the panel treat it as done; swallowed into 502 it reads as a
  // failure and the author retries something that has already happened.
  if (e instanceof AppError && e.code === 'gone') {
    return NextResponse.json({ error: 'Gone' }, { status: 410 });
  }
  if (e instanceof AppError && e.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof AppError && e.code === 'validation') {
    return NextResponse.json({ error: 'Invalid atom' }, { status: 422 });
  }
  return NextResponse.json({ error: message }, { status: 502 });
}
