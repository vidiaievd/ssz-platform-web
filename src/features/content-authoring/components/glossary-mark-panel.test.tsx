import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container, GlossaryMark, VocabularyItem, VocabularyList } from '@/features/content/types';

vi.mock('../actions/lesson-glossary', () => ({ markGlossaryWordAction: vi.fn() }));
vi.mock('../api/use-authoring-vocabulary', () => ({
  useAuthoringVocabularyLists: vi.fn(),
  useAuthoringVocabularyItems: vi.fn(),
}));
vi.mock('../api/use-authoring-lessons', () => ({ useLessonGlossaryMarks: vi.fn() }));

// jsdom doesn't implement scrollIntoView; Radix Select calls it when opening.
Element.prototype.scrollIntoView = vi.fn();

const { GlossaryMarkPanel } = await import('./glossary-mark-panel');
const { markGlossaryWordAction } = await import('../actions/lesson-glossary');
const { useAuthoringVocabularyLists, useAuthoringVocabularyItems } = await import(
  '../api/use-authoring-vocabulary'
);
const { useLessonGlossaryMarks } = await import('../api/use-authoring-lessons');

const CONTAINER: Container = {
  id: 'module-1',
  slug: 'module-1',
  title: 'Samfunn og kultur',
  containerType: 'module',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  visibility: 'public',
  accessTier: 'free_within_school',
  ownerUserId: 'user-1',
  createdAt: '',
  updatedAt: '',
};

const LIST: VocabularyList = {
  id: 'list-1',
  title: 'Arbeidsliv',
  targetLanguage: 'no',
  createdAt: '',
};

const ITEMS: VocabularyItem[] = [
  { id: 'vocab-1', lemma: 'sykepleier', translations: [], examples: [] },
  { id: 'vocab-2', lemma: 'lærer', translations: [], examples: [] },
];

function renderPanel(variantId: string | undefined) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <GlossaryMarkPanel lessonId="lesson-1" variantId={variantId} container={CONTAINER} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(markGlossaryWordAction).mockReset();
  vi.mocked(markGlossaryWordAction).mockResolvedValue({
    ok: true,
    value: { id: 'mark-2', vocabularyItemId: 'vocab-2', occurrenceCount: 1 },
  } as never);
  vi.mocked(useAuthoringVocabularyLists).mockReturnValue({ data: [LIST] } as never);
  vi.mocked(useAuthoringVocabularyItems).mockReturnValue({
    data: { items: ITEMS, total: 2, page: 1, limit: 20, totalPages: 1 },
  } as never);
  vi.mocked(useLessonGlossaryMarks).mockReturnValue({ data: [] } as never);
});

describe('GlossaryMarkPanel', () => {
  it('prompts to save the anchor text first when there is no variant yet', () => {
    renderPanel(undefined);
    expect(
      screen.getByText('Save the anchor text first to add glossary marks.'),
    ).toBeInTheDocument();
  });

  it('shows a no-list note when the module has no vocabulary list', () => {
    vi.mocked(useAuthoringVocabularyLists).mockReturnValue({ data: [] } as never);
    renderPanel('variant-1');
    expect(
      screen.getByText('This module has no vocabulary list yet — add one to mark glossary words.'),
    ).toBeInTheDocument();
  });

  it('shows already-marked words with their lemma and occurrence count', () => {
    const marks: GlossaryMark[] = [{ id: 'mark-1', vocabularyItemId: 'vocab-1', occurrenceCount: 2 }];
    vi.mocked(useLessonGlossaryMarks).mockReturnValue({ data: marks } as never);
    renderPanel('variant-1');
    expect(screen.getByText('sykepleier ×2')).toBeInTheDocument();
    // Already-marked words are excluded from the picker.
    expect(screen.queryByText('sykepleier', { selector: '[role="option"]' })).not.toBeInTheDocument();
  });

  it('marks the selected word and refreshes the marks query', async () => {
    renderPanel('variant-1');

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('lærer'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(markGlossaryWordAction).toHaveBeenCalledWith('lesson-1', 'variant-1', 'vocab-2');
  });
});
