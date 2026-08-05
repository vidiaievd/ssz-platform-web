import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('../api/use-authoring-vocabulary', () => ({
  useAuthoringVocabularyLists: vi.fn(),
  useAuthoringVocabularyItems: vi.fn(),
  useAuthoringVocabularyItem: vi.fn(),
}));
vi.mock('../actions/vocabulary', () => ({
  createVocabularyListAction: vi.fn(),
  saveVocabularyItemAction: vi.fn(),
  deleteVocabularyItemAction: vi.fn(),
}));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { VocabularyEditorPane } = await import('./vocabulary-editor-pane');
const { useAuthoringVocabularyLists, useAuthoringVocabularyItems } =
  await import('../api/use-authoring-vocabulary');

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

function renderPane() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <VocabularyEditorPane
          kind="vocab"
          lessonTitle="Yrker og oppgaver"
          state="draft"
          isLive={false}
          container={CONTAINER}
          backHref="/school/my-school/content/course-1"
          publishSlot={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useAuthoringVocabularyLists).mockReturnValue({
    data: [{ id: 'list-1', title: 'Core vocabulary', targetLanguage: 'no', createdAt: '' }],
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useAuthoringVocabularyItems).mockReturnValue({
    data: {
      items: [
        {
          id: 'item-1',
          lemma: 'sykepleier',
          ipa: 'sʏkəplaɪər',
          partOfSpeech: 'noun',
          translations: [{ id: 't-1', languageCode: 'en', translation: 'nurse' }],
          examples: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
    isLoading: false,
    isError: false,
  } as never);
});

describe('VocabularyEditorPane', () => {
  it('renders the existing word list in both the editor and the live preview', () => {
    renderPane();
    expect(screen.getAllByText('sykepleier')).toHaveLength(2);
    expect(screen.getByText('nurse')).toBeInTheDocument();
  });

  it('shows the create-list prompt when the module has no vocabulary list yet', () => {
    vi.mocked(useAuthoringVocabularyLists).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    renderPane();
    expect(screen.getByText('No vocabulary list yet.')).toBeInTheDocument();
  });
});
