import { type NextRequest, NextResponse } from 'next/server';

import { soundSessionCall } from '@/lib/api/sound-session-proxy';

/** Start the learner's pronunciation session, or hand back the open one (plan 86, step 13.4c). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { language, atomId } = (body ?? {}) as { language?: unknown; atomId?: unknown };
  if (typeof language !== 'string') {
    return NextResponse.json({ error: '"language" is required' }, { status: 400 });
  }
  return soundSessionCall({
    service: 'exercises',
    path: '/sound-sessions',
    method: 'POST',
    body: { language, ...(typeof atomId === 'string' ? { atomId } : {}) },
  });
}
