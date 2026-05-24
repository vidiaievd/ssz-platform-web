import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const data = await serverFetch({
      service: 'enrollment',
      path: '/api/v1/enrollments',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'enrollment',
      path: '/api/v1/enrollments',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Already enrolled' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 502 });
  }
}
