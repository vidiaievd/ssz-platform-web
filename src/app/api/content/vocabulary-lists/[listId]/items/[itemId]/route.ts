import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { VocabularyItem } from '@/features/content/types';

interface BackendItemFull {
  id: string;
  word: string;
  partOfSpeech: string | null;
  ipaTranscription: string | null;
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
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> },
) {
  const { listId, itemId } = await params;

  try {
    const data = await serverFetch<BackendItemFull>({
      service: 'content',
      path: `/vocabulary-lists/${listId}/items/${itemId}`,
    });
    return NextResponse.json(toFeShape(data));
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch vocabulary item' }, { status: 502 });
  }
}
