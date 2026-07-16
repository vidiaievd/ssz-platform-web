import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('../actions/lesson', () => ({ createLessonAction: vi.fn() }));
vi.mock('../actions/vocabulary', () => ({ createVocabularyListAction: vi.fn() }));
vi.mock('../actions/grammar', () => ({ createGrammarRuleAction: vi.fn() }));
vi.mock('../actions/exercise', () => ({ createExerciseAction: vi.fn() }));

const { AddLessonPicker } = await import('./add-lesson-picker');
const { createLessonAction } = await import('../actions/lesson');
const { createVocabularyListAction } = await import('../actions/vocabulary');
const { createGrammarRuleAction } = await import('../actions/grammar');
const { createExerciseAction } = await import('../actions/exercise');

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  moduleContainerId: 'module-1',
  targetLanguage: 'no',
  difficultyLevel: 'A2' as const,
  visibility: 'public' as const,
};

function renderPicker(onCreated = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AddLessonPicker {...DEFAULT_PROPS} onCreated={onCreated} />
    </NextIntlClientProvider>,
  );
  return { onCreated };
}

beforeEach(() => {
  vi.mocked(createLessonAction).mockReset();
  vi.mocked(createVocabularyListAction).mockReset();
  vi.mocked(createGrammarRuleAction).mockReset();
  vi.mocked(createExerciseAction).mockReset();
});

describe('AddLessonPicker', () => {
  it('renders a card for each of the 7 material types', () => {
    renderPicker();
    for (const label of ['Vocabulary', 'Reading', 'Video', 'Listening', 'Grammar', 'Practice', 'Live class']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('creates a text lesson and reports the new item id', async () => {
    vi.mocked(createLessonAction).mockResolvedValue({ ok: true, value: { itemId: 'item-1' } } as never);
    const { onCreated } = renderPicker();

    fireEvent.click(screen.getByText('Reading'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('item-1'));
    expect(createLessonAction).toHaveBeenCalledWith(
      'module-1',
      'no',
      'A2',
      'public',
      { title: 'New Reading' },
      'text',
    );
  });

  it('creates a video lesson with kind=video', async () => {
    vi.mocked(createLessonAction).mockResolvedValue({ ok: true, value: { itemId: 'item-2' } } as never);
    renderPicker();

    fireEvent.click(screen.getByText('Video'));

    await waitFor(() => expect(createLessonAction).toHaveBeenCalled());
    expect(createLessonAction).toHaveBeenCalledWith(
      'module-1',
      'no',
      'A2',
      'public',
      { title: 'New Video' },
      'video',
    );
  });

  it('creates a vocabulary list', async () => {
    vi.mocked(createVocabularyListAction).mockResolvedValue({
      ok: true,
      value: { listId: 'list-1', itemId: 'item-3' },
    } as never);
    const { onCreated } = renderPicker();

    fireEvent.click(screen.getByText('Vocabulary'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('item-3'));
  });

  it('scaffolds a placeholder multiple-choice exercise', async () => {
    vi.mocked(createExerciseAction).mockResolvedValue({
      ok: true,
      value: { exerciseId: 'ex-1', itemId: 'item-4' },
    } as never);
    const { onCreated } = renderPicker();

    fireEvent.click(screen.getByText('Practice'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('item-4'));
    expect(createExerciseAction).toHaveBeenCalledWith(
      'module-1',
      'no',
      'A2',
      'public',
      expect.objectContaining({
        templateCode: 'multiple_choice',
        mcQuestion: 'New Practice',
        mcOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
        mcCorrectIndex: 0,
      }),
    );
  });

  it('shows an error toast and does not close on failure', async () => {
    vi.mocked(createGrammarRuleAction).mockResolvedValue({
      ok: false,
      error: { code: 'validation' },
    } as never);
    const onOpenChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AddLessonPicker {...DEFAULT_PROPS} onOpenChange={onOpenChange} onCreated={vi.fn()} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByText('Grammar'));

    await waitFor(() => expect(createGrammarRuleAction).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
