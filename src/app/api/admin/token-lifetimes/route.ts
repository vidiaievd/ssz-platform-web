import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { TokenLifetimes } from '@/features/account/types/token-lifetimes';

/**
 * Refresh-token lifetimes by role and client (ADR-012), for platform administrators.
 *
 * A thin pass-through: auth-service owns the bounds and the permission (`AdminOnly`), so a
 * caller without `platform_admin` is refused there, not here. The screen mirrors the bounds
 * only to answer before the round trip.
 */
export async function GET() {
  try {
    const lifetimes = await serverFetch<TokenLifetimes>({
      service: 'auth',
      path: '/auth/admin/token-lifetimes',
      expectedErrorStatuses: [403],
    });
    return NextResponse.json(lifetimes);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }

  try {
    const lifetimes = await serverFetch<TokenLifetimes>({
      service: 'auth',
      path: '/auth/admin/token-lifetimes',
      method: 'PUT',
      body,
      expectedErrorStatuses: [403, 422],
    });
    return NextResponse.json(lifetimes);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
}

function errorBody(error: unknown): unknown {
  if (error instanceof AppError && error.code === 'validation') {
    return { error: 'validation', details: error.details };
  }
  if (error instanceof AppError && error.code === 'forbidden') {
    return { error: 'Forbidden' };
  }
  return { error: 'Session lifetimes could not be read' };
}

function statusOf(error: unknown, fallback: number): number {
  if (!(error instanceof AppError)) return fallback;
  if (error.code === 'validation') return 422;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'unauthenticated') return 401;
  return fallback;
}
