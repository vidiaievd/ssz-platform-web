import { NextRequest, NextResponse } from 'next/server';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { ExerciseDisplay } from '@/features/content/types';

// Content-service's exercise catalog has no random ordering — sampling happens here.
// Only multiple_choice is currently renderable on the web client, so the staircase
// is restricted to that template.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetLanguage = searchParams.get('targetLanguage');
  const difficultyLevel = searchParams.get('difficultyLevel');
  const excludeIds = new Set(searchParams.get('excludeIds')?.split(',').filter(Boolean) ?? []);

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
      (item) => item.templateCode === 'multiple_choice' && !excludeIds.has(item.id),
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
