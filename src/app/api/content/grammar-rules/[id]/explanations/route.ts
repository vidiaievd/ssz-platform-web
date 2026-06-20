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
}

// Mirrors the compose step in actions/grammar.ts — examples are appended to
// bodyMarkdown behind this marker since the backend has no dedicated field for them.
const EXAMPLES_MARKER = '\n\n<!-- examples -->\n';

function toFeShape(e: BackendExplanation): GrammarExplanation {
  const markerIndex = e.bodyMarkdown.indexOf(EXAMPLES_MARKER);
  const body = markerIndex === -1 ? e.bodyMarkdown : e.bodyMarkdown.slice(0, markerIndex);
  const examples =
    markerIndex === -1
      ? []
      : e.bodyMarkdown
          .slice(markerIndex + EXAMPLES_MARKER.length)
          .split('\n')
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter(Boolean);

  return {
    id: e.id,
    languageCode: e.explanationLanguage,
    title: e.displayTitle,
    body,
    examples,
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
