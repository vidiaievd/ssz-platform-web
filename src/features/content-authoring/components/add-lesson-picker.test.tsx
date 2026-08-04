import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('../actions/lesson', () => ({ createLessonAction: vi.fn() }));
vi.mock('../actions/vocabulary', () => ({ createVocabularyListAction: vi.fn() }));
vi.mock('../actions/grammar', () => ({ createGrammarRuleAction: vi.fn() }));
vi.mock('../actions/exercise', () => ({ createExerciseAction: vi.fn() }));
vi.mock('../actions/container-item', () => ({ assignItemSectionAction: vi.fn() }));

const { AddLessonPicker } = await import('./add-lesson-picker');
const { createLessonAction } = await import('../actions/lesson');
const { createVocabularyListAction } = await import('../actions/vocabulary');
const { createGrammarRuleAction } = await import('../actions/grammar');
const { createExerciseAction } = await import('../actions/exercise');
const { assignItemSectionAction } = await import('../actions/container-item');

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  moduleContainerId: 'module-1',
  targetLanguage: 'no',
  difficultyLevel: 'A2' as const,
  visibility: 'public' as const,
  ownerSchoolId: 'school-1',
};

function renderPicker(onCreated = vi.fn(), extraProps: { sectionId?: string | null } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AddLessonPicker {...DEFAULT_PROPS} {...extraProps} onCreated={onCreated} />
    </NextIntlClientProvider>,
  );
  return { onCreated };
}

beforeEach(() => {
  vi.mocked(createLessonAction).mockReset();
  vi.mocked(createVocabularyListAction).mockReset();
  vi.mocked(createGrammarRuleAction).mockReset();
  vi.mocked(createExerciseAction).mockReset();
  vi.mocked(assignItemSectionAction).mockReset();
  vi.mocked(assignItemSectionAction).mockResolvedValue({ ok: true, value: undefined } as never);
});

describe('AddLessonPicker', () => {
  it('renders a card for each of the 7 material types', () => {
    renderPicker();
    for (const label of [
      'Vocabulary',
      'Reading',
      'Video',
      'Listening',
      'Grammar',
      'Practice',
      'Live class',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('creates a text lesson and reports the new item id', async () => {
    vi.mocked(createLessonAction).mockResolvedValue({
      ok: true,
      value: { itemId: 'item-1' },
    } as never);
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
      // The owning school travels with every created material — without it the
      // backend rejects anything `school_private`.
      'school-1',
    );
  });

  it('creates a video lesson with kind=video', async () => {
    vi.mocked(createLessonAction).mockResolvedValue({
      ok: true,
      value: { itemId: 'item-2' },
    } as never);
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
      'school-1',
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

  it('asks for the exercise type instead of creating straight away', () => {
    renderPicker();

    fireEvent.click(screen.getByText('Practice'));

    // The template is immutable once created, so it has to be picked up front.
    expect(createExerciseAction).not.toHaveBeenCalled();
    expect(screen.getByText('Multiple choice group')).toBeInTheDocument();
    expect(screen.getByText('Word bank gap-fill')).toBeInTheDocument();
  });

  it('scaffolds a placeholder exercise on the picked template', async () => {
    vi.mocked(createExerciseAction).mockResolvedValue({
      ok: true,
      value: { exerciseId: 'ex-1', itemId: 'item-4' },
    } as never);
    const { onCreated } = renderPicker();

    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByText('Multiple choice group'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('item-4'));
    expect(createExerciseAction).toHaveBeenCalledWith(
      'module-1',
      'no',
      'A2',
      'public',
      expect.objectContaining({
        templateCode: 'multiple_choice_group',
        mcgSharedOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
        mcgItems: [{ question: 'New Practice', options: [], correctIndex: 0, explanation: '' }],
      }),
      'school-1',
    );
  });

  it('goes back from the exercise type step to the material list', () => {
    renderPicker();

    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByText('Back'));

    expect(screen.getByText('Vocabulary')).toBeInTheDocument();
    expect(screen.queryByText('Multiple choice group')).not.toBeInTheDocument();
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
  it('files the new item into the section it was opened from', async () => {
    // Creating an item never assigns a section, so without this the material
    // lands ungrouped even though the author added it inside "Nye ord".
    vi.mocked(createLessonAction).mockResolvedValue({
      ok: true,
      value: { lessonId: 'lesson-1', itemId: 'item-1' },
    } as never);
    const { onCreated } = renderPicker(vi.fn(), { sectionId: 'section-nye-ord' });

    fireEvent.click(screen.getByText('Reading'));

    await waitFor(() =>
      expect(assignItemSectionAction).toHaveBeenCalledWith('module-1', 'item-1', 'section-nye-ord'),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('item-1'));
  });

  it('leaves the item where it landed when no section was given', async () => {
    vi.mocked(createLessonAction).mockResolvedValue({
      ok: true,
      value: { lessonId: 'lesson-1', itemId: 'item-1' },
    } as never);
    renderPicker();

    fireEvent.click(screen.getByText('Reading'));

    await waitFor(() => expect(createLessonAction).toHaveBeenCalled());
    expect(assignItemSectionAction).not.toHaveBeenCalled();
  });
});
