import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    const data = await serverFetch({
      service: 'profile',
      path: `/api/v1/profiles/${userId}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 502 });
  }
}
