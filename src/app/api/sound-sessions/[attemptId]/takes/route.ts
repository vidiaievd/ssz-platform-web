import { type NextRequest, NextResponse } from 'next/server';

import { soundSessionCall } from '@/lib/api/sound-session-proxy';

/** One take of the session: an uploaded recording of this attempt, judged (plan 86, 13.4d). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { recordingAssetId, takeIndex, explanationLanguage } = (body ?? {}) as {
    recordingAssetId?: unknown;
    takeIndex?: unknown;
    explanationLanguage?: unknown;
  };
  if (typeof recordingAssetId !== 'string' || typeof takeIndex !== 'number') {
    return NextResponse.json(
      { error: '"recordingAssetId" and "takeIndex" are required' },
      { status: 400 },
    );
  }
  return soundSessionCall({
    service: 'exercises',
    path: `/sound-sessions/${encodeURIComponent(attemptId)}/takes`,
    method: 'POST',
    body: {
      recordingAssetId,
      takeIndex,
      ...(typeof explanationLanguage === 'string' ? { explanationLanguage } : {}),
    },
  });
}
