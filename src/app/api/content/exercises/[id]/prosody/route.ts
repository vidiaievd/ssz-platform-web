import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { ProsodyLayer, WordSounds } from '@/lib/shared-kernel/prosody';

/** What content-service hands a learner: one layer per `read` prompt (plan 86, §4c). */
export interface ExerciseProsodyResponse {
  prompts: { promptId: string; text: string; layer: ProsodyLayer; sounds: WordSounds[] }[];
}

/**
 * The intonation layer of a `read_aloud` exercise, for the learner who switched it on.
 *
 * Loaded on its own request, never inside the exercise document (§4a decision 3): most
 * learners never switch it on, and a failure here must cost nothing but the marks. So every
 * miss — no layer, no access, service down — answers with an empty list and the text is
 * drawn plain; only a missing session is passed on as 401.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const data = await serverFetch<ExerciseProsodyResponse>({
      service: 'content',
      path: `/exercises/${id}/prosody`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e) && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ prompts: [] } satisfies ExerciseProsodyResponse);
  }
}
