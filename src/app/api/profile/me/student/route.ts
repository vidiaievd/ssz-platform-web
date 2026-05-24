import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const data = await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me/student',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to get student profile' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me/student',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Student profile already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create student profile' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me/student',
      method: 'PATCH',
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update student profile' }, { status: 502 });
  }
}
