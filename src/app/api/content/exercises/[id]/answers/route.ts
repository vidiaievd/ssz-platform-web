import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ExerciseWithAnswers } from '@/features/content/types';

// Authoring-only: returns the exercise WITH expectedAnswers so the editor can
// prefill correct answers. The reader uses `/exercises/:id/display` (answers
// omitted) via the sibling `[id]` route.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await serverFetch<ExerciseWithAnswers>({
      service: 'content',
      path: `/exercises/${id}/answers`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch exercise' }, { status: 502 });
  }
}
