import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('../actions/lesson', () => ({ createLessonAction: vi.fn() }));
vi.mock('../actions/vocabulary', () => ({ createVocabularyListAction: vi.fn() }));
vi.mock('../actions/grammar', () => ({ createGrammarRuleAction: vi.fn() }));
vi.mock('../actions/exercise', () => ({ createExerciseAction: vi.fn() }));
vi.mock('../actions/gap-fill', () => ({ createGapFillAction: vi.fn() }));
vi.mock('../actions/error-correction', () => ({ createErrorCorrectionAction: vi.fn() }));
vi.mock('../actions/match-pairs', () => ({ createMatchPairsAction: vi.fn() }));
vi.mock('../actions/writing-task', () => ({ createWritingTaskAction: vi.fn() }));
vi.mock('../actions/short-answer', () => ({ createShortAnswerAction: vi.fn() }));
vi.mock('../actions/sentence-schema', () => ({ createSentenceSchemaAction: vi.fn() }));
vi.mock('../actions/multiple-choice', () => ({ createMultipleChoiceAction: vi.fn() }));
vi.mock('../actions/multiple-choice-group', () => ({ createMultipleChoiceGroupAction: vi.fn() }));
vi.mock('../actions/translate', () => ({
  createTranslateToTargetAction: vi.fn(),
  createTranslateFromTargetAction: vi.fn(),
}));
vi.mock('../actions/container-item', () => ({ assignItemSectionAction: vi.fn() }));

const { AddLessonPicker } = await import('./add-lesson-picker');
const { createLessonAction } = await import('../actions/lesson');
const { createVocabularyListAction } = await import('../actions/vocabulary');
const { createGrammarRuleAction } = await import('../actions/grammar');
const { createExerciseAction } = await import('../actions/exercise');
const { createGapFillAction } = await import('../actions/gap-fill');
const { createMultipleChoiceAction } = await import('../actions/multiple-choice');
const { createMultipleChoiceGroupAction } = await import('../actions/multiple-choice-group');
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
  vi.mocked(createGapFillAction).mockReset();
  vi.mocked(assignItemSectionAction).mockReset();
  vi.mocked(assignItemSectionAction).mockResolvedValue({ ok: true, value: undefined } as never);
});

describe('AddLessonPicker', () => {
  // "Practice" is gone from the material list on purpose: exercises are offered
  // by template in their own group, so picking "an exercise" and then its type
  // asked a question the author had already answered.
  it('groups reading material and exercise templates in one step', () => {
    renderPicker();

    expect(screen.getByText('Reading & vocabulary')).toBeInTheDocument();
    for (const label of ['Vocabulary', 'Reading', 'Video', 'Listening', 'Grammar', 'Live class']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Practice')).not.toBeInTheDocument();

    expect(screen.getByText('Exercises')).toBeInTheDocument();
    expect(screen.getByText('Multiple choice group')).toBeInTheDocument();
    expect(screen.getByText('Gap-fill')).toBeInTheDocument();
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

  it('no longer offers the two templates gap-fill replaced', () => {
    renderPicker();

    // Retired from creation only. Both still open and play: ~135 exercises use them.
    expect(screen.queryByText('Word bank gap-fill')).not.toBeInTheDocument();
    expect(screen.queryByText('Fill in the blank')).not.toBeInTheDocument();
  });

  it('creates a gap-fill from its own scaffold, not from the generic form', async () => {
    vi.mocked(createGapFillAction).mockResolvedValue({
      ok: true,
      value: { exerciseId: 'ex-9', itemId: 'item-9' },
    });
    renderPicker();

    fireEvent.click(screen.getByText('Gap-fill'));

    await waitFor(() => expect(createGapFillAction).toHaveBeenCalled());
    expect(createExerciseAction).not.toHaveBeenCalled();
  });

  it('creates a multiple choice from its own scaffold, not from the generic form', async () => {
    // The last of the thirteen templates to stop being created generically (plan 53 §8
    // Q5). Without the scaffold, "Add exercise → Multiple choice" writes the old
    // single-question shape, and the builder — which needs a set — never opens for it.
    vi.mocked(createMultipleChoiceAction).mockResolvedValue({
      ok: true,
      value: { exerciseId: 'ex-13', itemId: 'item-13' },
    });
    renderPicker();

    fireEvent.click(screen.getByText('Multiple choice'));

    await waitFor(() => expect(createMultipleChoiceAction).toHaveBeenCalled());
    expect(createExerciseAction).not.toHaveBeenCalled();
  });

  it('creates a statement table from its own scaffold, not from the generic form', async () => {
    // Plan 54 phase 5. The generic form still opens the two documents of the old
    // `items[]` form, but nothing new is written that way: without the scaffold the
    // builder would mount on a document with no `rows`, which the template's schema
    // refuses outright.
    vi.mocked(createMultipleChoiceGroupAction).mockResolvedValue({
      ok: true,
      value: { exerciseId: 'ex-14', itemId: 'item-14' },
    });
    renderPicker();

    fireEvent.click(screen.getByText('Multiple choice group'));

    await waitFor(() => expect(createMultipleChoiceGroupAction).toHaveBeenCalled());
    expect(createExerciseAction).not.toHaveBeenCalled();
  });

  it('scaffolds a placeholder exercise on a template that has no builder of its own', async () => {
    vi.mocked(createExerciseAction).mockResolvedValue({
      ok: true,
      value: { exerciseId: 'ex-1', itemId: 'item-4' },
    } as never);
    const { onCreated } = renderPicker();

    fireEvent.click(screen.getByText('Put in order'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('item-4'));
    expect(createExerciseAction).toHaveBeenCalledWith(
      'module-1',
      'no',
      'A2',
      'public',
      expect.objectContaining({
        templateCode: 'text_order',
        toLines: [
          { text: 'First line', speaker: '' },
          { text: 'Second line', speaker: '' },
        ],
      }),
      'school-1',
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
  it('says which section the new material will land in', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AddLessonPicker
          open
          onOpenChange={vi.fn()}
          moduleContainerId="module-1"
          sectionId="section-1"
          sectionTitle="Nye ord"
          targetLanguage="no"
          difficultyLevel="A2"
          visibility="public"
          ownerSchoolId="school-1"
          onCreated={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('The new material goes into “Nye ord”.')).toBeInTheDocument();
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
