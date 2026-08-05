import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonTextSpan } from '@/features/content/types';

import { buildGlossaryIndex } from '../lib/tokenize-glossary';

vi.mock('@/features/media', () => ({ useMediaAsset: () => ({ data: undefined }) }));
const useGrammarRule = vi.fn((_id: string) => ({
  data: { id: 'g1', title: 'Indirekte tale', targetLanguage: 'nb', createdAt: '', containerItemId: 'c1' },
  isLoading: false,
}));
vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useIntroduceCard: () => ({ mutate: vi.fn(), isPending: false }),
    useGrammarRule: (id: string) => useGrammarRule(id),
    useBestGrammarExplanation: () => ({ data: explanation() }),
  };
});
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

const { LessonProse } = await import('./lesson-prose');
const { AnnotationCardPanel } = await import('./annotation-card-panel');
const { GlossaryTargetProvider } = await import('./glossary-target-provider');
const { GrammarLinkProvider } = await import('./grammar-link-provider');
const { useSelectedAnnotationStore } = await import('../stores/selected-annotation-store');
const { useSelectedWordStore } = await import('../stores/selected-word-store');

/** Mutable so a test can model a rule authored before the summary field existed. */
let explanation: () => Record<string, unknown>;
const withSummary = () => ({
  id: 'e1',
  languageCode: 'ru',
  title: 'Indirekte tale',
  summary: 'Косвенная речь: at/om, порядок слов и сдвиг времён.',
  body: '# Indirekte tale\n\nПервый абзац про **at**.\n\nВторой абзац.',
  isPublished: true,
  anchorText: 'Han sa at han var trøtt.',
  anchorHighlights: ['var'],
  compareExamples: [],
  quickCheck: null,
});

const TEXT = 'Hun sier at den er god, men at han har noen skrivefeil.';
const SELECTION = 'at den er god';

function grammarSpan(note: string | null = null): LessonTextSpan {
  const charStart = TEXT.indexOf(SELECTION);
  return {
    id: 's1',
    paragraphIndex: 0,
    charStart,
    charEnd: charStart + SELECTION.length,
    kind: 'grammar',
    refId: 'g1',
    textSnapshot: SELECTION,
    note,
    broken: false,
    brokenReason: null,
    reanchorCandidates: [],
  };
}

/** The reader as it is on a wide screen: prose on the left, rail on the right. */
function renderWithRail({
  note = null,
  links = new Map<string, string>(),
}: { note?: string | null; links?: Map<string, string> } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <GrammarLinkProvider links={links}>
          <GlossaryTargetProvider target="panel">
            <LessonProse
              text={TEXT}
              glossary={buildGlossaryIndex([])}
              spans={[grammarSpan(note)]}
              explanationLanguage="ru"
            />
          </GlossaryTargetProvider>
          <AnnotationCardPanel explanationLanguage="ru" cefrLevel="B1" />
        </GrammarLinkProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const marker = () => screen.getByRole('button', { name: /show the grammar rule/i });

beforeEach(() => {
  explanation = withSummary;
  useSelectedAnnotationStore.getState().clear();
  useSelectedWordStore.getState().clear();
  useGrammarRule.mockClear();
});

describe('AnnotationCardPanel', () => {
  it('stays out of the rail until a marker is opened', () => {
    renderWithRail();

    // The rail's resting state is the word card, which the page renders in this
    // one's place; an empty rule card beside it would be a second invitation to
    // click the same text.
    expect(screen.queryByText('Indirekte tale')).not.toBeInTheDocument();
    // And nothing is fetched for a rule nobody has asked about.
    expect(useGrammarRule).not.toHaveBeenCalled();
  });

  it('shows the annotation in the rail instead of over the sentence', () => {
    renderWithRail({ note: 'Повтор союза at.' });

    fireEvent.click(marker());

    // Twice over: the annotated words in the prose, and quoted back by the card.
    expect(screen.getAllByText(SELECTION)).toHaveLength(2);
    expect(screen.getByText('Повтор союза at.')).toBeInTheDocument();
    expect(screen.getByText('Indirekte tale')).toBeInTheDocument();
    // The popover is what the rail replaces, so no dialog opens over the text.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the rule as a gist and a worked example, not as its lesson body', () => {
    renderWithRail();

    fireEvent.click(marker());

    expect(screen.getByText('Косвенная речь: at/om, порядок слов и сдвиг времён.')).toBeInTheDocument();
    // The example is the fastest way to recognise the same shape in the text.
    expect(screen.getByText('var')).toBeInTheDocument();
    // The body is written for the rule's own page: heading, then paragraphs.
    expect(screen.queryByText(/Первый абзац/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('#');
  });

  it('falls back to the first body paragraph when a rule has no summary', () => {
    explanation = () => ({ ...withSummary(), summary: null });
    renderWithRail();

    fireEvent.click(marker());

    // The heading is skipped — it only repeats the title already shown above.
    expect(screen.getByText('Первый абзац про at.')).toBeInTheDocument();
    expect(screen.queryByText(/Второй абзац/)).not.toBeInTheDocument();
  });

  it('links to the rule page only when the rule can be reached', () => {
    renderWithRail();
    fireEvent.click(marker());
    expect(screen.queryByRole('link', { name: /open the full rule/i })).not.toBeInTheDocument();

    screen.getByRole('button', { name: /close/i }).click();
    renderWithRail({ links: new Map([['g1', '/student/courses/c1/u9/i3']]) });
    fireEvent.click(screen.getAllByRole('button', { name: /show the grammar rule/i })[1]!);

    expect(screen.getByRole('link', { name: /open the full rule/i })).toHaveAttribute(
      'href',
      '/student/courses/c1/u9/i3',
    );
  });

  // Narrow screens have no rail, so the popover stays the whole card — and is
  // the only place the link can live there.
  it('keeps the link in the popover where there is no rail', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <GrammarLinkProvider links={new Map([['g1', '/student/courses/c1/u9/i3']])}>
            <GlossaryTargetProvider target="popover">
              <LessonProse
                text={TEXT}
                glossary={buildGlossaryIndex([])}
                spans={[grammarSpan()]}
                explanationLanguage="ru"
              />
            </GlossaryTargetProvider>
          </GrammarLinkProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(marker());

    expect(screen.getByRole('link', { name: /open the full rule/i })).toHaveAttribute(
      'href',
      '/student/courses/c1/u9/i3',
    );
  });

  it('closes back to nothing, handing the rail back to the word card', () => {
    renderWithRail({ note: 'Повтор союза at.' });

    fireEvent.click(marker());
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByText('Повтор союза at.')).not.toBeInTheDocument();
    expect(screen.queryByText('Indirekte tale')).not.toBeInTheDocument();
  });

  // The rail holds one card at a time, so each selection displaces the other.
  it('gives up the rail when the reader looks a word up', () => {
    renderWithRail({ note: 'Повтор союза at.' });
    fireEvent.click(marker());
    expect(screen.getByText('Повтор союза at.')).toBeInTheDocument();

    act(() => {
      useSelectedWordStore.getState().select({
        item: { id: 'v1', lemma: 'skrivefeil', translations: [], examples: [] },
      });
    });

    expect(screen.queryByText('Повтор союза at.')).not.toBeInTheDocument();
    expect(useSelectedAnnotationStore.getState().selected).toBeNull();
  });

  it('displaces the word card in turn', () => {
    renderWithRail();
    act(() => {
      useSelectedWordStore.getState().select({
        item: { id: 'v1', lemma: 'skrivefeil', translations: [], examples: [] },
      });
    });

    fireEvent.click(marker());

    expect(useSelectedWordStore.getState().selected).toBeNull();
  });
});
