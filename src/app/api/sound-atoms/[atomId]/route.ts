import { type NextRequest } from 'next/server';

import { soundSessionCall } from '@/lib/api/sound-session-proxy';

/** The learner's card of a sound: how to make it, in the interface language (plan 86, step 9.2). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ atomId: string }> },
) {
  const { atomId } = await params;
  return soundSessionCall({
    service: 'content',
    path: `/sound-atoms/${encodeURIComponent(atomId)}`,
    query: { locale: request.nextUrl.searchParams.get('locale') ?? undefined },
  });
}
