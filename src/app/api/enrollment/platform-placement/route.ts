import { NextRequest, NextResponse } from 'next/server';
import { scoreToCefr } from '@/features/enrollment/lib/score-to-cefr';
import type { LangCode, CEFR } from '@/features/groups/types';

// Platform-level placement results will be persisted in the student-profile service (planned).
// For now this endpoint derives the CEFR level and returns it; the caller stores the result
// in its own membership placement record via the membership placement endpoint.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { language, score, cefrLevel } = body as {
    language?: LangCode;
    score?: number;
    cefrLevel?: CEFR;
  };

  if (!language || score == null) {
    return NextResponse.json({ error: 'language and score are required' }, { status: 400 });
  }

  const derivedLevel = cefrLevel ?? scoreToCefr(score);

  return NextResponse.json({
    ok: true,
    level: derivedLevel,
    result: {
      language,
      cefrLevel: derivedLevel,
      score,
      takenAt: new Date().toISOString().slice(0, 10),
      scope: 'platform' as const,
      sourceLabel: 'platform',
    },
  });
}
