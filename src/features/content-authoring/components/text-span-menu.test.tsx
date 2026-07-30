import { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container, GrammarRule, VocabularyItem, VocabularyList } from '@/features/content/types';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../actions/lesson-spans', () => ({ createTextSpanAction: vi.fn() }));
vi.mock('../api/use-authoring-vocabulary', () => ({
  useAuthoringVocabularyLists: vi.fn(),
  useAuthoringVocabularyItems: vi.fn(),
}));
vi.mock('../api/use-authoring-grammar', () => ({ useAuthoringGrammarRules: vi.fn() }));

// jsdom doesn't implement scrollIntoView; Radix Select calls it when opening.
Element.prototype.scrollIntoView = vi.fn();

const { TextSpanMenu } = await import('./text-span-menu');
const { createTextSpanAction } = await import('../actions/lesson-spans');
const { useAuthoringVocabularyLists, useAuthoringVocabularyItems } = await import(
  '../api/use-authoring-vocabulary'
);
const { useAuthoringGrammarRules } = await import('../api/use-authoring-grammar');

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

const LIST: VocabularyList = { id: 'list-1', title: 'Arbeidsliv', targetLanguage: 'no', createdAt: '' };

const ITEMS: VocabularyItem[] = [
  { id: 'vocab-1', lemma: 'sykepleier', translations: [], examples: [] },
  { id: 'vocab-2', lemma: 'lærer', translations: [], examples: [] },
];

const RULES: GrammarRule[] = [
  {
    id: 'rule-1',
    title: 'Preteritum',
    targetLanguage: 'no',
    createdAt: '',
    containerItemId: 'item-1',
  },
];

const BODY = 'Hun er sykepleier.\n\nHun jobber om natten.';

/**
 * Stands in for the body textarea the menu reads its selection from. The real
 * one lives in TextEditorPane; the menu only ever touches `selectionStart`,
 * `selectionEnd` and whether the field has focus.
 */
function renderMenu({
  selection,
  variantId,
  body = BODY,
}: {
  selection: [number, number];
  /** Explicitly `undefined` models a body that has not been autosaved yet. */
  variantId?: string | undefined;
  body?: string;
}) {
  const ref = createRef<HTMLTextAreaElement>();
  const queryClient = new QueryClient();

  const tree = (value: string) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <textarea ref={ref} defaultValue={value} readOnly />
        <TextSpanMenu
          lessonId="lesson-1"
          variantId={variantId}
          container={CONTAINER}
          body={value}
          textareaRef={ref}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

  const { rerender } = render(tree(body));

  const el = ref.current!;
  el.focus();
  el.setSelectionRange(selection[0], selection[1]);
  // jsdom fires selectionchange asynchronously at best; drive it directly.
  act(() => {
    document.dispatchEvent(new Event('selectionchange'));
  });

  return {
    queryClient,
    textarea: el,
    rerenderWithBody: (next: string) => act(() => rerender(tree(next))),
  };
}

beforeEach(() => {
  vi.mocked(createTextSpanAction).mockReset();
  vi.mocked(createTextSpanAction).mockResolvedValue({
    ok: true,
    value: { id: 'span-1' },
  } as never);
  vi.mocked(useAuthoringVocabularyLists).mockReturnValue({ data: [LIST] } as never);
  vi.mocked(useAuthoringVocabularyItems).mockReturnValue({
    data: { items: ITEMS, total: 2, page: 1, limit: 20, totalPages: 1 },
  } as never);
  vi.mocked(useAuthoringGrammarRules).mockReturnValue({ data: RULES } as never);
});

const trigger = () => screen.getByRole('button', { name: 'Annotate selection' });

describe('TextSpanMenu', () => {
  it('stays disabled until something is selected', () => {
    renderMenu({ selection: [7, 7], variantId: 'variant-1' });
    expect(trigger()).toBeDisabled();
  });

  it('stays disabled for a whitespace-only selection', () => {
    renderMenu({ selection: [6, 7], variantId: 'variant-1' });
    expect(trigger()).toBeDisabled();
  });

  it('stays disabled when the selection crosses a paragraph boundary', () => {
    renderMenu({ selection: [7, BODY.indexOf('jobber') + 6], variantId: 'variant-1' });
    expect(trigger()).toBeDisabled();
  });

  it('enables once a word inside one paragraph is selected', () => {
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });
    expect(trigger()).toBeEnabled();
  });

  it('shows the exact text the anchor will hold', () => {
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });
    fireEvent.click(trigger());
    expect(screen.getByText('Selected: “sykepleier”')).toBeInTheDocument();
  });

  it('sends paragraph-relative offsets, not body offsets', async () => {
    // "natten" sits in the second paragraph, 14 characters in.
    const start = BODY.indexOf('natten');
    renderMenu({ selection: [start, start + 6], variantId: 'variant-1' });

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('sykepleier'));
    fireEvent.click(screen.getByRole('button', { name: 'Annotate' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(createTextSpanAction).toHaveBeenCalledWith('lesson-1', 'variant-1', {
      paragraphIndex: 1,
      charStart: 14,
      charEnd: 20,
      kind: 'vocab',
      refId: 'vocab-1',
      note: undefined,
    });
  });

  it('requires a referent before a vocab span can be created', () => {
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });
    fireEvent.click(trigger());
    expect(screen.getByRole('button', { name: 'Annotate' })).toBeDisabled();
  });

  it('creates a grammar span against the picked rule', async () => {
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('radio', { name: 'Grammar' }));
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Preteritum'));
    fireEvent.click(screen.getByRole('button', { name: 'Annotate' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(createTextSpanAction).toHaveBeenCalledWith(
      'lesson-1',
      'variant-1',
      expect.objectContaining({ kind: 'grammar', refId: 'rule-1' }),
    );
  });

  it('creates a chunk with no referent and needs no pick', async () => {
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('radio', { name: 'Chunk' }));

    const create = screen.getByRole('button', { name: 'Annotate' });
    expect(create).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Fast uttrykk' },
    });
    fireEvent.click(create);

    await act(async () => {
      await Promise.resolve();
    });

    expect(createTextSpanAction).toHaveBeenCalledWith(
      'lesson-1',
      'variant-1',
      expect.objectContaining({ kind: 'chunk', refId: undefined, note: 'Fast uttrykk' }),
    );
  });

  it('drops a referent picked under a different kind', async () => {
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('sykepleier'));
    // Switching kind must not carry the vocabulary id over to a grammar span.
    fireEvent.click(screen.getByRole('radio', { name: 'Grammar' }));

    expect(screen.getByRole('button', { name: 'Annotate' })).toBeDisabled();
  });

  it('keeps focus in the textarea so the selection stays visible', () => {
    const { textarea } = renderMenu({ selection: [7, 17], variantId: 'variant-1' });

    fireEvent.click(trigger());

    // Radix would move focus into the popover, and browsers stop painting the
    // selection of an unfocused field — leaving the author unable to see what
    // they are annotating.
    expect(screen.getByText('Selected: “sykepleier”')).toBeInTheDocument();
    expect(document.activeElement).toBe(textarea);
  });

  it('drops the selection when the body is edited under it', () => {
    const { rerenderWithBody } = renderMenu({ selection: [7, 17], variantId: 'variant-1' });
    expect(trigger()).toBeEnabled();

    // Same offsets, different text: annotating now would mark a stretch the
    // author never picked.
    rerenderWithBody('Helt annen tekst her.\n\nOg et andre avsnitt.');

    expect(trigger()).toBeDisabled();
  });

  it('prompts to save the anchor text when the body has no variant yet', () => {
    // Reachable in practice: the author types, selects, and the first autosave
    // has not created the variant yet. The button must explain, not just sit
    // dead — so it stays enabled and the popover carries the reason.
    renderMenu({ selection: [7, 17], variantId: undefined });

    expect(trigger()).toBeEnabled();
    fireEvent.click(trigger());
    expect(screen.getByText('Save the anchor text first to annotate it.')).toBeInTheDocument();
  });

  it('offers to add a vocabulary list when the module has none', () => {
    vi.mocked(useAuthoringVocabularyLists).mockReturnValue({ data: [] } as never);
    renderMenu({ selection: [7, 17], variantId: 'variant-1' });

    fireEvent.click(trigger());
    expect(
      screen.getByText('This module has no vocabulary list yet — add one to annotate lexis.'),
    ).toBeInTheDocument();
  });

  it('explains an overlap instead of showing the generic conflict message', async () => {
    vi.mocked(createTextSpanAction).mockResolvedValue({
      ok: false,
      error: { code: 'conflict', message: 'SPAN_OVERLAP' },
    } as never);
    const { toast } = await import('sonner');

    renderMenu({ selection: [7, 17], variantId: 'variant-1' });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('sykepleier'));
    fireEvent.click(screen.getByRole('button', { name: 'Annotate' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      'This selection overlaps an annotation of the same type. Adjust the selection, or remove the other one first.',
    );
  });
});
