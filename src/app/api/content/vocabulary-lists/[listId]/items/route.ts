import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { VocabularyItem } from '@/features/content/types';

interface BackendItemSummary {
  id: string;
  word: string;
  partOfSpeech: string | null;
  ipaTranscription: string | null;
}

interface BackendItemFull extends BackendItemSummary {
  translations: { language: string; primaryTranslation: string }[];
  usageExamples: { id: string; exampleText: string }[];
}

function toFeShape(item: BackendItemFull): VocabularyItem {
  return {
    id: item.id,
    lemma: item.word,
    partOfSpeech: item.partOfSpeech ?? undefined,
    ipa: item.ipaTranscription ?? undefined,
    translations: item.translations.map((t) => ({
      languageCode: t.language,
      translation: t.primaryTranslation,
    })),
    examples: item.usageExamples.map((e) => ({
      id: e.id,
      template: e.exampleText,
      substitution: '',
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  const { listId } = await params;
  const { searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }

  try {
    const summaries = await serverFetch<{
      items: BackendItemSummary[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>({
      service: 'content',
      path: `/vocabulary-lists/${listId}/items`,
      query,
    });

    // The list endpoint omits translations/examples — fetch full details per
    // item (lists are small in practice; no batch endpoint exists for this).
    const fullItems = await Promise.all(
      summaries.items.map((s) =>
        serverFetch<BackendItemFull>({
          service: 'content',
          path: `/vocabulary-lists/${listId}/items/${s.id}`,
        }),
      ),
    );

    return NextResponse.json({
      items: fullItems.map(toFeShape),
      total: summaries.total,
      page: summaries.page,
      limit: summaries.limit,
      totalPages: summaries.totalPages,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ items: [], total: 0, page: 1, limit: 0, totalPages: 0 });
    }
    return NextResponse.json({ error: 'Failed to fetch vocabulary items' }, { status: 502 });
  }
}
