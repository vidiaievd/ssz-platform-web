import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyItem, VocabularyList } from '@/features/content/types';
import type { ReaderSidebarItem } from '../types';

const useVocabularyList = vi.fn();
const useUnitVocabularyItems = vi.fn();
const useMediaAsset = vi.fn((_id?: string) => ({ data: undefined }));

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useVocabularyList: (id: string) => useVocabularyList(id),
    useUnitVocabularyItems: (id: string) => useUnitVocabularyItems(id),
  };
});
vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
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
  { id: 'vocab-1', kind: 'vocab', title: 'Yrker og oppgaver', durationLabel: '', status: 'available', href: '/x' },
  { id: 'text-1', kind: 'text', title: 'En vanlig arbeidsdag', durationLabel: '5 min', status: 'available', href: '/student/courses/c1/u1/text-1' },
];

function renderPage(overrides: Partial<React.ComponentProps<typeof VocabularyPage>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VocabularyPage
        vocabularyListId="list-1"
        cefrLevel="B1"
        unitPosition={4}
        courseTitle="Norsk B1"
        srsVocabDue={8}
        siblingItems={SIBLING_ITEMS}
        currentItemId="vocab-1"
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe('VocabularyPage', () => {
  it('shows a loading skeleton while fetching', () => {
    useVocabularyList.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useUnitVocabularyItems.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    const refetchList = vi.fn();
    const refetchItems = vi.fn();
    useVocabularyList.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: refetchList });
    useUnitVocabularyItems.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: refetchItems });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchList).toHaveBeenCalled();
    expect(refetchItems).toHaveBeenCalled();
  });

  it('shows an empty state when the list has no items', () => {
    useVocabularyList.mockReturnValue({ isLoading: false, isError: false, data: LIST, refetch: vi.fn() });
    useUnitVocabularyItems.mockReturnValue({ isLoading: false, isError: false, data: [], refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('No new words yet')).toBeInTheDocument();
  });

  it('renders the card grid, translation-mode badge for A1–B1, reinforce link, and review card', () => {
    useVocabularyList.mockReturnValue({ isLoading: false, isError: false, data: LIST, refetch: vi.fn() });
    useUnitVocabularyItems.mockReturnValue({ isLoading: false, isError: false, data: ITEMS, refetch: vi.fn() });
    renderPage({ cefrLevel: 'B1' });

    expect(screen.getByText('Yrker og oppgaver')).toBeInTheDocument();
    expect(screen.getByText('nurse')).toBeInTheDocument();
    expect(screen.getByText('to work')).toBeInTheDocument();
    expect(screen.getByText('A1–B1 · translation')).toBeInTheDocument();

    const reinforceLink = screen.getByRole('link', { name: /en vanlig arbeidsdag/i });
    expect(reinforceLink).toHaveAttribute('href', '/student/courses/c1/u1/text-1');

    expect(screen.getByText('Repeat earlier words')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/student/srs');
  });

  it('shows the definition-mode badge for B2+', () => {
    useVocabularyList.mockReturnValue({ isLoading: false, isError: false, data: LIST, refetch: vi.fn() });
    useUnitVocabularyItems.mockReturnValue({ isLoading: false, isError: false, data: ITEMS, refetch: vi.fn() });
    renderPage({ cefrLevel: 'B2' });
    expect(screen.getByText('B2+ · explanation')).toBeInTheDocument();
  });

  it('omits the review card when nothing is due', () => {
    useVocabularyList.mockReturnValue({ isLoading: false, isError: false, data: LIST, refetch: vi.fn() });
    useUnitVocabularyItems.mockReturnValue({ isLoading: false, isError: false, data: ITEMS, refetch: vi.fn() });
    renderPage({ srsVocabDue: 0 });
    expect(screen.queryByText('Repeat earlier words')).not.toBeInTheDocument();
  });
});
