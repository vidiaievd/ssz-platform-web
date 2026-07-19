import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container, ContainerItem } from '@/features/content/types';

// jsdom doesn't implement scrollIntoView; Radix Select's viewport-scroll
// effect calls it when opening a dropdown with a pre-selected value.
Element.prototype.scrollIntoView ??= () => {};

vi.mock('../actions/lesson-video-question', () => ({
  setVideoQuestionAction: vi.fn(),
  clearVideoQuestionAction: vi.fn(),
}));
vi.mock('../api/use-authoring-lessons', () => ({ useLessonVideoQuestion: vi.fn() }));
vi.mock('../api/use-authoring-exercises', () => ({ useAuthoringExercises: vi.fn() }));
vi.mock('./exercise-editor', () => ({ ExerciseEditor: () => <div>exercise editor</div> }));

const { ComprehensionQuestionRow } = await import('./comprehension-question-row');
const { setVideoQuestionAction, clearVideoQuestionAction } = await import(
  '../actions/lesson-video-question'
);
const { useLessonVideoQuestion } = await import('../api/use-authoring-lessons');
const { useAuthoringExercises } = await import('../api/use-authoring-exercises');

const CONTAINER = { id: 'container-1' } as Container;

const EXERCISES: ContainerItem[] = [
  {
    id: 'item-1',
    containerVersionId: 'version-1',
    position: 0,
    itemType: 'exercise',
    itemId: 'exercise-1',
    isRequired: false,
    title: 'Match the pairs',
    addedAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderRow(variantId: string | undefined) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ComprehensionQuestionRow lessonId="lesson-1" variantId={variantId} container={CONTAINER} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(setVideoQuestionAction).mockReset();
  vi.mocked(setVideoQuestionAction).mockResolvedValue({
    ok: true,
    value: { questionId: 'question-1' },
  } as never);
  vi.mocked(clearVideoQuestionAction).mockReset();
  vi.mocked(clearVideoQuestionAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useLessonVideoQuestion).mockReturnValue({ data: null, isLoading: false } as never);
  vi.mocked(useAuthoringExercises).mockReturnValue({ data: EXERCISES, isLoading: false } as never);
});

describe('ComprehensionQuestionRow', () => {
  it('prompts to add a video source first when there is no variant yet', () => {
    renderRow(undefined);
    expect(
      screen.getByText('Add a video source before adding a comprehension question.'),
    ).toBeInTheDocument();
  });

  it('shows the currently linked exercise', () => {
    vi.mocked(useLessonVideoQuestion).mockReturnValue({
      data: { exerciseId: 'exercise-1' },
      isLoading: false,
    } as never);
    renderRow('variant-1');
    expect(screen.getByText('Match the pairs')).toBeInTheDocument();
  });

  it('links the selected exercise', async () => {
    renderRow('variant-1');

    fireEvent.click(screen.getByLabelText('Comprehension question exercise'));
    fireEvent.click(await screen.findByText('Match the pairs'));

    await waitFor(() => {
      expect(setVideoQuestionAction).toHaveBeenCalledWith('lesson-1', 'variant-1', 'exercise-1');
    });
  });

  it('unlinks when "No comprehension question" is selected', async () => {
    vi.mocked(useLessonVideoQuestion).mockReturnValue({
      data: { exerciseId: 'exercise-1' },
      isLoading: false,
    } as never);
    renderRow('variant-1');

    fireEvent.click(screen.getByLabelText('Comprehension question exercise'));
    fireEvent.click(await screen.findByText('No comprehension question'));

    await waitFor(() => {
      expect(clearVideoQuestionAction).toHaveBeenCalledWith('lesson-1', 'variant-1');
    });
  });

  it('opens the inline exercise editor for creating a new exercise', () => {
    renderRow('variant-1');
    fireEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    expect(screen.getByText('exercise editor')).toBeInTheDocument();
  });
});
