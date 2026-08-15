import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ExerciseRuleLink } from '@/features/content/types';

// The exercise pool read from the exercise's side: which grammar rules practise this one.
// Authoring asks it to show what an exercise trains; the review queue asks the opposite
// question through `/grammar-rules/:id/pool`.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const data = await serverFetch<ExerciseRuleLink[]>({
      service: 'content',
      path: `/exercises/${id}/grammar-rules`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch grammar rules' }, { status: 502 });
  }
}
