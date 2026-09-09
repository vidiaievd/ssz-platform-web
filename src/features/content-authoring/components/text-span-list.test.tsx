import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  Container,
  LessonTextSpan,
  VocabularyItem,
  VocabularyList,
} from '@/features/content/types';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../actions/lesson-spans', () => ({
  deleteTextSpanAction: vi.fn(),
  updateTextSpanAction: vi.fn(),
}));
vi.mock('../api/use-authoring-lessons', () => ({ useLessonTextSpans: vi.fn() }));
vi.mock('../api/use-authoring-vocabulary', () => ({
  useAuthoringVocabularyLists: vi.fn(),
  useAuthoringVocabularyItems: vi.fn(),
}));

const { TextSpanList } = await import('./text-span-list');
const { deleteTextSpanAction, updateTextSpanAction } = await import('../actions/lesson-spans');
const { useLessonTextSpans } = await import('../api/use-authoring-lessons');
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

const LIST: VocabularyList = {
  id: 'list-1',
  title: 'Arbeidsliv',
  targetLanguage: 'no',
  createdAt: '',
};
const ITEMS: VocabularyItem[] = [
  { id: 'vocab-1', lemma: 'sykepleier', translations: [], examples: [] },
];

function span(overrides: Partial<LessonTextSpan> = {}): LessonTextSpan {
  return {
    id: 'span-1',
    paragraphIndex: 0,
    charStart: 7,
    charEnd: 17,
    kind: 'vocab',
    refId: 'vocab-1',
    textSnapshot: 'sykepleier',
    note: null,
    broken: false,
    brokenReason: null,
    reanchorCandidates: [],
    ...overrides,
  };
}

function renderList(spans: LessonTextSpan[]) {
  vi.mocked(useLessonTextSpans).mockReturnValue({ data: spans } as never);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TextSpanList lessonId="lesson-1" variantId="variant-1" container={CONTAINER} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  vi.mocked(deleteTextSpanAction)
    .mockReset()
    .mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(updateTextSpanAction)
    .mockReset()
    .mockResolvedValue({ ok: true, value: span() } as never);
  vi.mocked(useAuthoringVocabularyLists).mockReturnValue({ data: [LIST] } as never);
  vi.mocked(useAuthoringVocabularyItems).mockReturnValue({
    data: { items: ITEMS, total: 1, page: 1, limit: 20, totalPages: 1 },
  } as never);
});

describe('TextSpanList', () => {
  it('renders nothing when the variant has no annotations', () => {
    renderList([]);
    expect(screen.queryByText(/annotation/)).not.toBeInTheDocument();
  });

  it('shows the annotated text with its referent', () => {
    renderList([span()]);
    expect(screen.getByText('sykepleier')).toBeInTheDocument();
    expect(screen.getByText('— sykepleier')).toBeInTheDocument();
    expect(screen.getByText('1 annotation in this text.')).toBeInTheDocument();
  });

  it('falls back to the note as a chunk’s label', () => {
    renderList([
      span({ kind: 'chunk', refId: null, note: 'Fast uttrykk', textSnapshot: 'på grunn av' }),
    ]);
    expect(screen.getByText('— Fast uttrykk')).toBeInTheDocument();
  });

  it('deletes a span', async () => {
    renderList([span()]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the annotation on “sykepleier”' }));
    await flush();
    expect(deleteTextSpanAction).toHaveBeenCalledWith('lesson-1', 'variant-1', 'span-1');
  });

  it('lists broken spans apart from working ones', () => {
    renderList([
      span(),
      span({ id: 'span-2', broken: true, brokenReason: 'offset', textSnapshot: 'natten' }),
    ]);
    expect(screen.getByText('1 annotation lost its anchor')).toBeInTheDocument();
    // The intact one is still counted on its own.
    expect(screen.getByText('1 annotation in this text.')).toBeInTheDocument();
  });

  it('reattaches a broken span from its only candidate', async () => {
    renderList([
      span({
        broken: true,
        brokenReason: 'offset',
        reanchorCandidates: [{ paragraphIndex: 1, charStart: 4, charEnd: 14 }],
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Reattach' }));
    await flush();

    expect(updateTextSpanAction).toHaveBeenCalledWith('lesson-1', 'variant-1', 'span-1', {
      paragraphIndex: 1,
      charStart: 4,
      charEnd: 14,
    });
  });

  it('refuses a one-click repair when the snapshot occurs more than once', () => {
    renderList([
      span({
        broken: true,
        brokenReason: 'offset',
        reanchorCandidates: [
          { paragraphIndex: 0, charStart: 7, charEnd: 17 },
          { paragraphIndex: 2, charStart: 0, charEnd: 10 },
        ],
      }),
    ]);

    expect(screen.queryByRole('button', { name: 'Reattach' })).not.toBeInTheDocument();
    expect(
      screen.getByText('This text now occurs more than once — select it again to reattach.'),
    ).toBeInTheDocument();
  });

  it('says so when the snapshot is gone from the body entirely', () => {
    renderList([span({ broken: true, brokenReason: 'offset', reanchorCandidates: [] })]);
    expect(screen.getByText('This text is no longer in the body.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reattach' })).not.toBeInTheDocument();
  });

  it('offers no reattach for a span whose referent was deleted', () => {
    renderList([span({ broken: true, brokenReason: 'ref' })]);
    expect(screen.getByText('Its word or rule was deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reattach' })).not.toBeInTheDocument();
  });

  it('saves an edited note without touching kind or referent', async () => {
    renderList([
      span({ kind: 'chunk', refId: null, note: 'Fast uttrykk', textSnapshot: 'på grunn av' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit the note on “på grunn av”' }));
    const field = screen.getByLabelText('Note (optional)');
    expect(field).toHaveValue('Fast uttrykk');

    fireEvent.change(field, { target: { value: 'Styrer genitiv her' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await flush();

    // Only the note is sent: kind and refId are immutable by design, and an
    // anchor field would move the span.
    expect(updateTextSpanAction).toHaveBeenCalledWith('lesson-1', 'variant-1', 'span-1', {
      note: 'Styrer genitiv her',
    });
  });

  it('clears the note when the field is emptied', async () => {
    renderList([span({ kind: 'chunk', refId: null, note: 'Fast uttrykk' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit the note on “sykepleier”' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await flush();

    expect(updateTextSpanAction).toHaveBeenCalledWith('lesson-1', 'variant-1', 'span-1', {
      note: null,
    });
  });

  it('does not save when the edit is cancelled', () => {
    renderList([span({ note: 'keep me' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit the note on “sykepleier”' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'discard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateTextSpanAction).not.toHaveBeenCalled();
  });

  it('keeps a broken span until the author acts on it', async () => {
    renderList([span({ broken: true, brokenReason: 'offset', reanchorCandidates: [] })]);
    await flush();
    // Nothing is auto-deleted: the snapshot is often the only record of intent.
    expect(deleteTextSpanAction).not.toHaveBeenCalled();
    expect(screen.getByText('sykepleier')).toBeInTheDocument();
  });
});
