import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { GrammarExplanation } from '@/features/content/types';

interface BackendExplanation {
  id: string;
  explanationLanguage: string;
  displayTitle: string;
  bodyMarkdown: string;
  status: string;
  compareExamples: { sentence: string }[];
}

function toFeShape(e: BackendExplanation): GrammarExplanation {
  return {
    id: e.id,
    languageCode: e.explanationLanguage,
    title: e.displayTitle,
    body: e.bodyMarkdown,
    examples: e.compareExamples.map((c) => c.sentence),
    isPublished: e.status === 'published',
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await serverFetch<{ items: BackendExplanation[] }>({
      service: 'content',
      path: `/grammar-rules/${id}/explanations`,
    });
    return NextResponse.json(data.items.map(toFeShape));
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch grammar explanations' }, { status: 502 });
  }
}
