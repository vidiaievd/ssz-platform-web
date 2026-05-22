import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ContainerShare } from '@/features/content/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<ContainerShare[]>({
      service: 'content',
      path: `/api/v1/shares?entityType=${entityType}&entityId=${entityId}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const share = await serverFetch<ContainerShare>({
      service: 'content',
      path: '/api/v1/shares',
      method: 'POST',
      body,
    });
    return NextResponse.json(share, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create share' }, { status: 502 });
  }
}
