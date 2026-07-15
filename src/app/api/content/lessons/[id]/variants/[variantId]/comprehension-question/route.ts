import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonVideoQuestion } from '@/features/content/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  const { id, variantId } = await params;

  try {
    const data = await serverFetch<LessonVideoQuestion | null>({
      service: 'content',
      path: `/lessons/${id}/variants/${variantId}/comprehension-question`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json(null, { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch comprehension question' }, { status: 502 });
  }
}
