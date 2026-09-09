import { NextRequest, NextResponse } from 'next/server';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { ExerciseDisplay } from '@/features/content/types';
import { isMultipleChoiceDocument } from '@/lib/shared-kernel/multiple-choice';

// Content-service's exercise catalog has no random ordering — sampling happens here.
// `templateCodes` (comma-separated) controls which templates are eligible;
// defaults to `multiple_choice` for backward compatibility with the old staircase.
//
// The template code is not enough on its own (plan 53 §1.2). `multiple_choice` now covers
// two live document shapes, and the placement test plays only the old one: it asks a single
// question, grades it in the browser and has no attempt to answer against. A reseeded set
// carries the same template code and would sample cleanly — and then arrive at a runner
// that has no question to draw. It is filtered out here, at the point that chooses.

/** Can the placement runner play this document, or is it a shape it was never taught? */
function playableInPlacement(item: ExerciseDisplay): boolean {
  if (item.templateCode !== 'multiple_choice') return true;
  return !isMultipleChoiceDocument(item.content);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetLanguage = searchParams.get('targetLanguage');
  const difficultyLevel = searchParams.get('difficultyLevel');
  const excludeIds = new Set(searchParams.get('excludeIds')?.split(',').filter(Boolean) ?? []);
  const allowedCodes = new Set(
    searchParams.get('templateCodes')?.split(',').filter(Boolean) ?? ['multiple_choice'],
  );

  if (!targetLanguage || !difficultyLevel) {
    return NextResponse.json(
      { error: '"targetLanguage" and "difficultyLevel" are required' },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch<{ items: ExerciseDisplay[] }>({
      service: 'content',
      path: '/exercises',
      query: { targetLanguage, difficultyLevel, limit: 20 },
    });

    const candidates = (data.items ?? []).filter(
      (item) =>
        allowedCodes.has(item.templateCode) &&
        !excludeIds.has(item.id) &&
        playableInPlacement(item),
    );

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No exercises available at this level' }, { status: 404 });
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return NextResponse.json(picked);
  } catch {
    return NextResponse.json({ error: 'Failed to sample an exercise' }, { status: 502 });
  }
}
