import { render, screen, act, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container, LessonListeningStage } from '@/features/content/types';

vi.mock('../actions/listening-stages', () => ({ saveListeningStagesAction: vi.fn() }));
vi.mock('../api/use-authoring-lessons', () => ({ useListeningStages: vi.fn() }));
vi.mock('../api/use-authoring-exercises', () => ({ useAuthoringExercises: vi.fn() }));
// The inline exercise creator has its own suite and pulls in server actions.
vi.mock('./exercise-editor', () => ({ ExerciseEditor: () => null }));

const { ListeningStageListEditor } = await import('./listening-stage-list-editor');
const { saveListeningStagesAction } = await import('../actions/listening-stages');
const { useListeningStages } = await import('../api/use-authoring-lessons');
const { useAuthoringExercises } = await import('../api/use-authoring-exercises');

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

const STAGES: LessonListeningStage[] = [
  { exerciseId: 'exercise-1', position: 0, stageType: 'comprehension' },
];

function renderEditor(props: { variantId?: string; surface?: 'audio' | 'text' } = {}) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ListeningStageListEditor
          lessonId="lesson-1"
          variantId={'variantId' in props ? props.variantId : 'variant-1'}
          container={CONTAINER}
          surface={props.surface}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(saveListeningStagesAction).mockReset();
  vi.mocked(saveListeningStagesAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useListeningStages).mockReturnValue({ data: [], isLoading: false } as never);
  vi.mocked(useAuthoringExercises).mockReturnValue({
    data: [{ itemId: 'exercise-1', title: 'Hvor bor Marta?' }],
    isLoading: false,
  } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ListeningStageListEditor', () => {
  it('speaks about listening on the audio surface, which is the default', () => {
    renderEditor();

    expect(screen.getByText('Staged exercises')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No staged exercises yet — add one to build the Listen → Gap-fill → Comprehension flow.',
      ),
    ).toBeInTheDocument();
  });

  it('speaks about reading comprehension on the text surface', () => {
    renderEditor({ surface: 'text' });

    expect(screen.getByText('Comprehension check')).toBeInTheDocument();
    expect(
      screen.getByText('No questions yet — add one to check understanding after the reading.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Staged exercises')).not.toBeInTheDocument();
  });

  it('asks the author to save the text first when the lesson has no variant yet', () => {
    renderEditor({ variantId: undefined, surface: 'text' });

    expect(
      screen.getByText('Save the lesson text before adding comprehension questions.'),
    ).toBeInTheDocument();
  });

  it('seeds rows from the saved stages regardless of surface', () => {
    vi.mocked(useListeningStages).mockReturnValue({ data: STAGES, isLoading: false } as never);
    renderEditor({ surface: 'text' });

    expect(screen.getByText('Hvor bor Marta?')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Stage type' })).toHaveTextContent('Comprehension');
  });

  it('saves a stage list built on the text surface through the same replace-all action', async () => {
    vi.mocked(useListeningStages).mockReturnValue({ data: STAGES, isLoading: false } as never);
    renderEditor({ surface: 'text' });

    act(() => {
      screen.getByRole('button', { name: 'Remove stage 1' }).click();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
    });

    expect(saveListeningStagesAction).toHaveBeenCalledWith('lesson-1', 'variant-1', []);
  });
});
