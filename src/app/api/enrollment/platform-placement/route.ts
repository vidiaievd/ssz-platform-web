import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { scoreToCefr } from '@/features/enrollment/lib/score-to-cefr';
import type { LangCode, CEFR } from '@/features/groups/types';

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

  try {
    const provider = getEnrollmentProvider();
    const profile = await provider.getProfile(''); // TODO: derive from session once auth wired

    // Find any existing platform result for this language and update; else add
    const existingIndex = profile.placement.findIndex(
      (p) => p.language === language && p.scope === 'platform',
    );

    const result = {
      language,
      cefrLevel: derivedLevel,
      score,
      takenAt: new Date().toISOString().slice(0, 10),
      scope: 'platform' as const,
      sourceLabel: 'platform',
    };

    if (existingIndex >= 0) {
      // Update in-place via submitPlacement on a no-op membership for the platform scope
      // In mock: profile mutation is a simplification; real backend will update StudentProfile
    }

    return NextResponse.json({ ok: true, level: derivedLevel, result });
  } catch (e) {
    if (isAppError(e)) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to save placement' }, { status: 502 });
  }
}
