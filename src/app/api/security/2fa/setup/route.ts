import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST() {
  try {
    const data = await serverFetch({
      service: 'auth',
      path: '/auth/2fa/setup',
      method: 'POST',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to initiate 2FA setup' }, { status: 502 });
  }
}
