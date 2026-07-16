import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonListeningStage } from '@/features/content/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  const { id, variantId } = await params;

  try {
    const data = await serverFetch<LessonListeningStage[]>({
      service: 'content',
      path: `/lessons/${id}/variants/${variantId}/listening-stages`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch listening stages' }, { status: 502 });
  }
}
