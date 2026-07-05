import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/app-error';

export function handleBffError(e: unknown, fallback: string) {
  if (e instanceof AppError && e.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (e instanceof AppError && e.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof AppError && e.code === 'conflict') {
    return NextResponse.json(e.details ?? { error: e.message }, { status: 409 });
  }
  // Unexpected error — report and return a generic 502.
  Sentry.captureException(e, { extra: { fallback } });
  return NextResponse.json({ error: fallback }, { status: 502 });
}
