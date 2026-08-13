import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { VocabularyItem, VocabularyList } from '@/features/content/types';
import type { ReaderSidebarItem } from '../types';

const useVocabularyList = vi.fn();
const useUnitVocabularyItems = vi.fn();
const introduceMutate = vi.fn();
const bulkMutate = vi.fn();

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useVocabularyList: (id: string) => useVocabularyList(id),
    useUnitVocabularyItems: (id: string) => useUnitVocabularyItems(id),
    useIntroduceCard: () => ({ mutate: introduceMutate, isPending: false }),
    useBulkIntroduceFromList: () => ({ mutate: bulkMutate, isPending: false }),
  };
});
vi.mock('@/features/media', () => ({ useMediaAsset: () => ({ data: undefined }) }));
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

const { VocabularyPage } = await import('./vocabulary-page');

const LIST: VocabularyList = {
  id: 'list-1',
  title: 'Yrker og oppgaver',
  targetLanguage: 'nb',
  createdAt: '2026-01-01T00:00:00Z',
};

const ITEMS: VocabularyItem[] = [
  {
    id: 'v1',
    lemma: 'sykepleier',
    partOfSpeech: 'noun',
    translations: [{ languageCode: 'en', translation: 'nurse' }],
    examples: [],
  },
  {
    id: 'v2',
    lemma: 'jobbe',
    partOfSpeech: 'verb',
    translations: [{ languageCode: 'en', translation: 'to work' }],
    examples: [],
  },
];

const SIBLING_ITEMS: ReaderSidebarItem[] = [
  {
    id: 'vocab-1',
    kind: 'vocab',
    title: 'Yrker og oppgaver',
    durationLabel: '',
    status: 'available',
    href: '/x',
  },
  {
    id: 'text-1',
    kind: 'text',
    title: 'En vanlig arbeidsdag',
    durationLabel: '5 min',
    status: 'available',
    href: '/student/courses/c1/u1/text-1',
  },
];

function renderPage(overrides: Partial<React.ComponentProps<typeof VocabularyPage>> = {}) {
  return renderWithProviders(
    <VocabularyPage
      vocabularyListId="list-1"
      cefrLevel="B1"
      unitPosition={4}
      courseTitle="Norsk B1"
      srsVocabDue={8}
      siblingItems={SIBLING_ITEMS}
      currentItemId="vocab-1"
      {...overrides}
    />,
  );
}

function mockLoaded(items: VocabularyItem[] = ITEMS) {
  useVocabularyList.mockReturnValue({
    isLoading: false,
    isError: false,
    data: LIST,
    refetch: vi.fn(),
  });
  useUnitVocabularyItems.mockReturnValue({
    isLoading: false,
    isError: false,
    data: items,
    refetch: vi.fn(),
  });
}

describe('VocabularyPage', () => {
  beforeEach(() => {
    introduceMutate.mockReset();
    bulkMutate.mockReset();
  });

  it('shows a loading skeleton while fetching', () => {
    useVocabularyList.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });
    useUnitVocabularyItems.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    const refetchList = vi.fn();
    const refetchItems = vi.fn();
    useVocabularyList.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: refetchList,
    });
    useUnitVocabularyItems.mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
      refetch: refetchItems,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchList).toHaveBeenCalled();
    expect(refetchItems).toHaveBeenCalled();
  });

  it('shows an empty state when the list has no items', () => {
    useVocabularyList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: LIST,
      refetch: vi.fn(),
    });
    useUnitVocabularyItems.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('No new words yet')).toBeInTheDocument();
  });

  it('opens on the sorting stage with the first word, not a grid of every word', () => {
    mockLoaded();
    renderPage();

    expect(screen.getByText('Yrker og oppgaver')).toBeInTheDocument();
    expect(screen.getByText('sykepleier')).toBeInTheDocument();
    expect(screen.queryByText('jobbe')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('A1–B1 · translation')).toBeInTheDocument();
  });

  it('seeds a claimed word as known and leaves it out of the learn stage', () => {
    mockLoaded();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'I know it' }));
    expect(introduceMutate).toHaveBeenCalledWith(
      { contentType: 'VOCABULARY_WORD', contentId: 'v1', seedKind: 'CLAIMED_KNOWN' },
      expect.anything(),
    );

    // Second word sorted as new — the learn stage then holds only that one.
    fireEvent.click(screen.getByRole('button', { name: 'New to me' }));
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(screen.getByText('jobbe')).toBeInTheDocument();
  });

  it('reveals the meaning on the learn card and finishes into the summary', () => {
    mockLoaded();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'New to me' }));
    fireEvent.click(screen.getByRole('button', { name: 'New to me' }));

    expect(screen.getByText('nurse')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next word/i }));
    expect(screen.getByText('to work')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(screen.getByText('The words are ready')).toBeInTheDocument();
    expect(
      screen.getByText('You knew 0 and met 2 new ones. They’ll come back in review.'),
    ).toBeInTheDocument();
  });

  it('skips straight to the summary when every word is claimed at once', () => {
    mockLoaded();
    bulkMutate.mockImplementation((_input, opts) => opts.onSuccess?.());
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'I know all of them' }));
    expect(bulkMutate).toHaveBeenCalledWith(
      { vocabularyListId: 'list-1', seedKind: 'CLAIMED_KNOWN' },
      expect.anything(),
    );
    expect(
      screen.getByText('You knew 2 and met 0 new ones. They’ll come back in review.'),
    ).toBeInTheDocument();
  });

  it('shows the reinforce link and review card once the flow is done', () => {
    mockLoaded();
    bulkMutate.mockImplementation((_input, opts) => opts.onSuccess?.());
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'I know all of them' }));

    expect(screen.getByRole('link', { name: /en vanlig arbeidsdag/i })).toHaveAttribute(
      'href',
      '/student/courses/c1/u1/text-1',
    );
    expect(screen.getByText('Repeat earlier words')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/student/srs');
  });

  it('omits the review card when nothing is due', () => {
    mockLoaded();
    bulkMutate.mockImplementation((_input, opts) => opts.onSuccess?.());
    renderPage({ srsVocabDue: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'I know all of them' }));

    expect(screen.queryByText('Repeat earlier words')).not.toBeInTheDocument();
  });

  it('counts the words still missing from the study set', async () => {
    mockLoaded();
    bulkMutate.mockImplementation((_input, opts) => opts.onSuccess?.());
    // `v1` already has a card; a word with none is simply absent from the response.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          states: [
            { contentId: 'v1', state: 'REVIEW', stability: 4, dueAt: '2026-08-20T00:00:00Z' },
          ],
        }),
      ),
    );

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'I know all of them' }));

    expect(await screen.findByText('1 words are not in your study set yet')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('lists every word with its meaning in the list view', () => {
    mockLoaded();
    renderPage({ cefrLevel: 'B2' });

    expect(screen.getByText('B2+ · explanation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Word list' }));

    expect(screen.getByText('sykepleier')).toBeInTheDocument();
    expect(screen.getByText('jobbe')).toBeInTheDocument();
    expect(screen.getByText('nurse')).toBeInTheDocument();
    expect(screen.getByText('to work')).toBeInTheDocument();
  });
});
