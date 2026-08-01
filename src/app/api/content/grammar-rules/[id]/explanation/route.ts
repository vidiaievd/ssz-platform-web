import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { GrammarExplanationDetail } from '@/features/content/types';

interface BackendExplanation {
  id: string;
  explanationLanguage: string;
  displayTitle: string;
  displaySummary: string | null;
  bodyMarkdown: string;
  status: string;
  anchorText: string | null;
  anchorHighlights: string[];
  anchorNote: string | null;
  compareExamples: {
    id: string;
    sentence: string;
    note: string | null;
    isCorrect: boolean;
  }[];
  quickCheck: {
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  } | null;
}

function toFeShape(e: BackendExplanation): GrammarExplanationDetail {
  return {
    id: e.id,
    languageCode: e.explanationLanguage,
    title: e.displayTitle,
    summary: e.displaySummary,
    body: e.bodyMarkdown,
    examples: e.compareExamples.map((c) => c.sentence),
    isPublished: e.status === 'published',
    anchorText: e.anchorText,
    anchorHighlights: e.anchorHighlights,
    anchorNote: e.anchorNote,
    compareExamples: e.compareExamples.map((c) => ({
      id: c.id,
      sentence: c.sentence,
      note: c.note,
      isCorrect: c.isCorrect,
    })),
    quickCheck: e.quickCheck,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const lang = searchParams.get('lang');
  const level = searchParams.get('level');
  const knownLangs = searchParams.get('knownLangs') ?? undefined;
  if (!lang || !level) {
    return NextResponse.json(
      { error: 'lang and level query params are required' },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch<{ explanation: BackendExplanation; fallbackUsed: boolean }>({
      service: 'content',
      path: `/grammar-rules/${id}/explanations/best`,
      query: { lang, level, knownLangs },
    });
    return NextResponse.json(toFeShape(data.explanation));
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch grammar explanation' }, { status: 502 });
  }
}
