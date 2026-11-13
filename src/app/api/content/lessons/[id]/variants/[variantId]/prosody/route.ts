import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { ProsodyLayer, WordSounds } from '@/lib/shared-kernel/prosody';

/** What content-service hands a learner: one layer per paragraph, anchors local to it (plan 86, §4c). */
export interface LessonProsodyResponse {
  paragraphs: { paragraphIndex: number; text: string; layer: ProsodyLayer; sounds: WordSounds[] }[];
}

/**
 * The pronunciation layer of a text lesson variant, for the learner who switched it on.
 *
 * Its own request, never part of the lesson body (§4a decision 3). Every miss answers with an
 * empty list and the text is drawn plain; only a missing session is passed on as 401.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  const { id, variantId } = await params;

  try {
    const data = await serverFetch<LessonProsodyResponse>({
      service: 'content',
      path: `/lessons/${id}/variants/${variantId}/prosody`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e) && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ paragraphs: [] } satisfies LessonProsodyResponse);
  }
}
