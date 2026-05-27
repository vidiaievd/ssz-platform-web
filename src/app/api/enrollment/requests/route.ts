import { NextRequest, NextResponse } from 'next/server';

import type { EnrollmentRequestsResponse } from '@/features/enrollment/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const data = await serverFetch<EnrollmentRequestsResponse>({
      service: 'enrollment',
      path: '/enrollments',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch enrollment requests' }, { status: 502 });
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
      path: '/enrollments',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Already requested' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create enrollment request' }, { status: 502 });
  }
}
