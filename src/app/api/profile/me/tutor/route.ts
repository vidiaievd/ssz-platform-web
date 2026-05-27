import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const data = await serverFetch({
      service: 'profile',
      path: '/profiles/me/tutor',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to get tutor profile' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await serverFetch({
      service: 'profile',
      path: '/profiles/me/tutor',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Tutor profile already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create tutor profile' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await serverFetch({
      service: 'profile',
      path: '/profiles/me/tutor',
      method: 'PATCH',
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update tutor profile' }, { status: 502 });
  }
}
