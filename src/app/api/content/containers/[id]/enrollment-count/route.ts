import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await serverFetch<{ count: number }>({
      service: 'enrollment',
      path: '/enrollments/count',
      query: { containerId: id },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e) && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch enrollment count' }, { status: 502 });
  }
}
