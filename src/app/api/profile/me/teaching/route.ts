import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const data = await serverFetch({
      service: 'profile',
      path: '/profiles/me/teaching',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to get teaching profile' }, { status: 502 });
  }
}

export async function POST() {
  try {
    const data = await serverFetch({
      service: 'profile',
      path: '/profiles/me/teaching',
      method: 'POST',
      body: {},
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Teaching profile already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create teaching profile' }, { status: 502 });
  }
}
