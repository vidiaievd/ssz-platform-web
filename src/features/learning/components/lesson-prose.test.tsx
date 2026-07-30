import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonSpanKind, LessonTextSpan, VocabularyItem } from '@/features/content/types';
import { buildGlossaryIndex } from '../lib/tokenize-glossary';

const useMediaAsset = vi.fn((_id?: string) => ({ data: undefined }));
vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));
const useGrammarRule = vi.fn((_id: string) => ({
  data: { id: 'g1', title: 'Presens perfektum', targetLanguage: 'nb', createdAt: '', containerItemId: 'c1' },
  isLoading: false,
}));
const useBestGrammarExplanation = vi.fn(() => ({
  data: {
    id: 'e1',
    languageCode: 'en',
    title: 'Presens perfektum',
    body: 'Formen er **har** + perfektum partisipp.\n\nMerk at noen verb bruker «er».',
    isPublished: true,
    anchorHighlights: [],
    compareExamples: [],
    quickCheck: null,
  },
}));
vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useIntroduceCard: () => ({ mutate: vi.fn(), isPending: false }),
    useGrammarRule: (id: string) => useGrammarRule(id),
    useBestGrammarExplanation: () => useBestGrammarExplanation(),
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

const FAGBREV: VocabularyItem = {
  id: 'v1',
  lemma: 'fagbrev',
  partOfSpeech: 'noun',
  translations: [{ languageCode: 'en', translation: 'trade certificate' }],
  examples: [],
};

const ERFARING: VocabularyItem = {
  id: 'v2',
  lemma: 'erfaring',
  partOfSpeech: 'noun',
  forms: [{ label: 'Ubestemt flertall', value: 'erfaringer' }],
  translations: [{ languageCode: 'en', translation: 'experience' }],
  examples: [],
};

// The job ad from «1A — Bartek søker ny jobb», as content-service hands it over.
const JOB_AD = [
  '> **Erfaren elektriker søkes**',
  '>',
  '> Nordby Elektro AS er et voksende firma med tolv ansatte.',
  '>',
  '> **Vi ønsker at du:**',
  '> - har fagbrev som elektriker',
  '> - har minst tre års erfaring',
].join('\n');

interface ProseOptions {
  spans?: LessonTextSpan[];
  authoredVocabulary?: boolean;
  spansHidden?: boolean;
  explanationLanguage?: string;
}

function renderProse(text: string, items: VocabularyItem[] = [], options: ProseOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LessonProse text={text} glossary={buildGlossaryIndex(items)} {...options} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/**
 * Builds a span the way the author's selection would: by pointing at a literal
 * piece of the paragraph source, so the fixtures stay readable when offsets
 * shift.
 */
function spanOver(
  paragraph: string,
  selection: string,
  kind: LessonSpanKind,
  refId: string | null = null,
): LessonTextSpan {
  const charStart = paragraph.indexOf(selection);
  if (charStart < 0) throw new Error(`fixture does not contain ${JSON.stringify(selection)}`);
  return {
    id: `s-${kind}-${charStart}`,
    paragraphIndex: 0,
    charStart,
    charEnd: charStart + selection.length,
    kind,
    refId,
    textSnapshot: selection,
    note: null,
    broken: false,
    brokenReason: null,
    reanchorCandidates: [],
  };
}

const lookups = () => screen.queryAllByRole('button', { name: /look up/i });

describe('LessonProse', () => {
  it('renders markdown structure instead of its source characters', () => {
    const { container } = renderProse(JOB_AD);

    expect(container.textContent).not.toMatch(/[>*]/);
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('Erfaren elektriker søkes').tagName).toBe('STRONG');

    const items = within(container.querySelector('ul')!).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'har fagbrev som elektriker',
      'har minst tre års erfaring',
    ]);
  });

  it('joins a soft-wrapped paragraph into flowing text', () => {
    renderProse('Bartek har jobbet som elektriker i det samme\nfirmaet i tre år.');
    expect(
      screen.getByText('Bartek har jobbet som elektriker i det samme firmaet i tre år.'),
    ).toBeInTheDocument();
  });

  it('renders a heading as a heading element', () => {
    renderProse('## Forstå teksten');
    expect(screen.getByRole('heading', { name: 'Forstå teksten' })).toBeInTheDocument();
  });

  it('keeps a date at the start of a line out of a list', () => {
    const { container } = renderProse('17. mai er Norges nasjonaldag.');
    expect(container.querySelector('ul')).not.toBeInTheDocument();
    expect(screen.getByText('17. mai er Norges nasjonaldag.')).toBeInTheDocument();
  });

  it('looks up a glossary word inside a list item', () => {
    renderProse(JOB_AD, [FAGBREV]);

    const trigger = screen.getByRole('button', { name: /look up: fagbrev/i });
    fireEvent.click(trigger);
    expect(screen.getByText('trade certificate')).toBeInTheDocument();
  });

  it('looks up a glossary word that sits inside a bold run, without splitting it', () => {
    renderProse('> **Erfaren elektriker med lang erfaring søkes**', [ERFARING]);

    const triggers = screen.getAllByRole('button', { name: /look up: erfaring/i });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]!.textContent).toBe('erfaring');
    // The emphasis still applies to the word, it is just nested inside the trigger.
    expect(triggers[0]!.querySelector('strong')).toBeInTheDocument();
  });

  it('does not request audio for words that are not glossary-marked', () => {
    useMediaAsset.mockClear();
    renderProse('Nordby Elektro AS er et voksende firma.', []);
    expect(useMediaAsset).not.toHaveBeenCalled();
  });
});

describe('LessonProse author spans', () => {
  beforeEach(() => {
    useGrammarRule.mockClear();
    useBestGrammarExplanation.mockClear();
  });

  // Two matchable surfaces of the same item: the lemma and a declared form.
  const TEXT = 'Lang erfaring teller. Mange erfaringer teller mer.';

  // Spec 16 §8 obligation 12, both halves.
  it('highlights every tokenizer match when the variant has no spans', () => {
    renderProse(TEXT, [ERFARING]);
    expect(lookups().map((b) => b.textContent)).toEqual(['erfaring', 'erfaringer']);
  });

  it('highlights only the authored occurrence once the variant has a vocab span', () => {
    renderProse(TEXT, [ERFARING], {
      spans: [spanOver(TEXT, 'erfaringer', 'vocab', ERFARING.id)],
      authoredVocabulary: true,
    });

    // The tokenizer is off for the whole text, so the unmarked "erfaring" in
    // the first sentence stays plain — the author's choice is the only signal.
    expect(lookups().map((b) => b.textContent)).toEqual(['erfaringer']);
  });

  it('opens the vocabulary card from an authored span', () => {
    renderProse(TEXT, [ERFARING], {
      spans: [spanOver(TEXT, 'erfaringer', 'vocab', ERFARING.id)],
      authoredVocabulary: true,
    });

    fireEvent.click(lookups()[0]!);
    expect(screen.getByText('experience')).toBeInTheDocument();
    // The surface form met in the text is reported, not just the lemma.
    expect(screen.getByText(/Ubestemt flertall/)).toBeInTheDocument();
  });

  it('renders a chunk as one unbroken backdrop rather than per word', () => {
    const text = 'Han har bodd her i det siste.';
    const { container } = renderProse(text, [], { spans: [spanOver(text, 'i det siste', 'chunk')] });

    const marked = container.querySelectorAll('[data-span-kind="chunk"]');
    expect(marked).toHaveLength(1);
    expect(marked[0]!.textContent).toBe('i det siste');
  });

  it('renders a grammar span with its own kind', () => {
    const text = 'Hun har bodd i Norge i tre år.';
    const { container } = renderProse(text, [], {
      spans: [spanOver(text, 'har bodd', 'grammar', 'g1')],
    });

    const marked = container.querySelector('[data-span-kind="grammar"]');
    expect(marked?.textContent).toBe('har bodd');
    expect(container.textContent).toBe(text);
  });

  it('nests a vocabulary lookup inside the chunk that contains it', () => {
    const text = 'Du må ha fagbrev som elektriker.';
    const { container } = renderProse(text, [FAGBREV], {
      spans: [
        spanOver(text, 'ha fagbrev som elektriker', 'chunk'),
        spanOver(text, 'fagbrev', 'vocab', FAGBREV.id),
      ],
      authoredVocabulary: true,
    });

    const chunk = container.querySelector('[data-span-kind="chunk"]')!;
    expect(chunk.textContent).toBe('ha fagbrev som elektriker');
    expect(within(chunk as HTMLElement).getByRole('button', { name: /look up: fagbrev/i })).toBeInTheDocument();
  });

  it('leaves a span crossing a list-item boundary as plain text', () => {
    const text = 'Vi ønsker at du:\n- har fagbrev\n- har erfaring';
    const { container } = renderProse(text, [], {
      spans: [spanOver(text, 'fagbrev\n- har', 'chunk')],
    });

    expect(container.querySelector('[data-span-kind]')).not.toBeInTheDocument();
    const items = within(container.querySelector('ul')!).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['har fagbrev', 'har erfaring']);
  });

  it('drops a span that covers only markup', () => {
    const text = 'Han er **veldig** ivrig.';
    const { container } = renderProse(text, [], { spans: [spanOver(text, '**', 'chunk')] });

    expect(container.querySelector('[data-span-kind]')).not.toBeInTheDocument();
    expect(container.textContent).toBe('Han er veldig ivrig.');
  });

  it('strips emphasis delimiters out of the highlighted range', () => {
    const text = 'Vi tilbyr **et godt arbeidsmiljø** til alle.';
    const { container } = renderProse(text, [], {
      spans: [spanOver(text, '**et godt arbeidsmiljø**', 'chunk')],
    });

    expect(container.querySelector('[data-span-kind="chunk"]')!.textContent).toBe(
      'et godt arbeidsmiljø',
    );
  });

  it('renders a vocab span with no resolvable item as plain text', () => {
    const text = 'Han har fagbrev.';
    const { container } = renderProse(text, [], {
      // Marked in the body, but absent from this unit's vocabulary list.
      spans: [spanOver(text, 'fagbrev', 'vocab', 'missing')],
      authoredVocabulary: true,
    });

    expect(lookups()).toHaveLength(0);
    expect(container.textContent).toBe(text);
  });

  it('keeps the chunk backdrop inert and puts the note behind a sibling marker', () => {
    const text = 'Du må ha fagbrev som elektriker.';
    const { container } = renderProse(text, [FAGBREV], {
      spans: [
        { ...spanOver(text, 'ha fagbrev som elektriker', 'chunk'), note: 'Fast uttrykk.' },
        spanOver(text, 'fagbrev', 'vocab', FAGBREV.id),
      ],
      authoredVocabulary: true,
    });

    // Nesting the note trigger around the backdrop would put a button inside a
    // button, since a chunk routinely contains glossed words.
    const chunk = container.querySelector('[data-span-kind="chunk"]') as HTMLElement;
    expect(chunk.querySelectorAll('button')).toHaveLength(0);
    expect(within(chunk).getByRole('button', { name: /look up: fagbrev/i })).toBeInTheDocument();

    const marker = screen.getByRole('button', { name: /show the note/i });
    expect(chunk.contains(marker)).toBe(false);
    fireEvent.click(marker);
    expect(screen.getByText('Fast uttrykk.')).toBeInTheDocument();
  });

  it('gives a chunk with no note no marker at all', () => {
    const text = 'Han har bodd her i det siste.';
    renderProse(text, [], { spans: [spanOver(text, 'i det siste', 'chunk')] });
    expect(screen.queryByRole('button', { name: /show the note/i })).not.toBeInTheDocument();
  });

  it('loads the grammar rule only once its marker is opened', () => {
    const text = 'Hun har bodd i Norge i tre år.';
    renderProse(text, [], {
      spans: [spanOver(text, 'har bodd', 'grammar', 'g1')],
      explanationLanguage: 'en',
    });

    expect(useGrammarRule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /show the grammar rule/i }));
    expect(useGrammarRule).toHaveBeenCalledWith('g1');
    expect(screen.getByText('Presens perfektum')).toBeInTheDocument();
    expect(screen.getByText(/har \+ perfektum partisipp/)).toBeInTheDocument();
  });

  it('shows only the first paragraph of a long explanation, without its markup', () => {
    const text = 'Hun har bodd i Norge i tre år.';
    renderProse(text, [], {
      spans: [spanOver(text, 'har bodd', 'grammar', 'g1')],
      explanationLanguage: 'en',
    });

    fireEvent.click(screen.getByRole('button', { name: /show the grammar rule/i }));
    // The fixture's second paragraph belongs to the grammar lesson, not here.
    expect(screen.queryByText(/Merk at/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('**');
  });

  it('withholds grammar and chunk backdrops when glossing is off, keeping lexis clickable', () => {
    const text = 'Du må ha fagbrev som elektriker.';
    const { container } = renderProse(text, [FAGBREV], {
      spans: [
        spanOver(text, 'ha fagbrev som elektriker', 'chunk'),
        spanOver(text, 'fagbrev', 'vocab', FAGBREV.id),
      ],
      authoredVocabulary: true,
      spansHidden: true,
    });

    expect(container.querySelector('[data-span-kind]')).not.toBeInTheDocument();
    // Undecorated but still a lookup target, as in C3's `off` mode.
    expect(lookups()).toHaveLength(1);
  });
});
