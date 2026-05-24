import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  try {
    const data = await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me/student/languages',
      method: 'POST',
      body: { language: code },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to add language' }, { status: 502 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  try {
    await serverFetch({
      service: 'profile',
      path: `/api/v1/profiles/me/student/languages/${code}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to remove language' }, { status: 502 });
  }
}
