import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const data = await serverFetch({
      service: 'media',
      path: '/media/assets',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 502 });
  }
}
