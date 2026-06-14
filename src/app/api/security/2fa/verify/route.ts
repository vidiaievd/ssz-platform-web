import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await serverFetch({
      service: 'auth',
      path: '/auth/2fa/verify',
      method: 'POST',
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to verify 2FA code' }, { status: 502 });
  }
}
