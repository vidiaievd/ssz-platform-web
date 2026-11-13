import { type NextRequest } from 'next/server';

import { soundSessionCall } from '@/lib/api/sound-session-proxy';

/** Hand the session in: the sounds' ratings reach the learner's cards (plan 86, 13.5). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;
  return soundSessionCall({
    service: 'exercises',
    path: `/sound-sessions/${encodeURIComponent(attemptId)}/submit`,
    method: 'POST',
    query: { locale: request.nextUrl.searchParams.get('locale') ?? undefined },
  });
}
