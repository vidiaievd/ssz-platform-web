import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonTextSpan } from '@/features/content/types';

/**
 * Positional lexis/grammar/chunk annotations for a TEXT lesson variant (spec 16).
 *
 * `includeBroken=true` is for authoring surfaces, which need the spans whose
 * anchor rotted so the author can repair them; the reader omits it and the
 * service withholds them.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  const { id, variantId } = await params;
  const includeBroken = request.nextUrl.searchParams.get('includeBroken') === 'true';

  try {
    const data = await serverFetch<LessonTextSpan[]>({
      service: 'content',
      path: `/lessons/${id}/variants/${variantId}/spans`,
      query: includeBroken ? { includeBroken: 'true' } : undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch text spans' }, { status: 502 });
  }
}
