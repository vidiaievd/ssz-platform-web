import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await serverFetch({
      service: 'profile',
      path: '/profiles/me/teaching/languages',
      method: 'POST',
      body,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Language already added' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add teaching language' }, { status: 502 });
  }
}
