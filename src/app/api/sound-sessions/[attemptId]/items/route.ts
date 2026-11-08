import { type NextRequest } from 'next/server';

import { soundSessionCall } from '@/lib/api/sound-session-proxy';

/** The step in hand: reference clips as signed links and the base's instruction (plan 86, 13.4d). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;
  return soundSessionCall({
    service: 'exercises',
    path: `/sound-sessions/${encodeURIComponent(attemptId)}/items`,
    query: { locale: request.nextUrl.searchParams.get('locale') ?? undefined },
  });
}
