import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    await serverFetch({
      service: 'auth',
      path: '/auth/2fa',
      method: 'DELETE',
      body,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 502 });
  }
}
