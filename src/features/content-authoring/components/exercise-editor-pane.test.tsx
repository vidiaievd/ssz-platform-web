import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('../actions/exercise', () => ({
  updateExerciseAction: vi.fn(),
}));
// The pane now reaches the gap-fill builder, which imports its autosave server action.
// Server modules are stripped from the client bundle for real; here they would run.
vi.mock('../actions/gap-fill', () => ({ saveGapFillAction: vi.fn() }));
vi.mock('../api/use-authoring-exercises', () => ({
  useAuthoringExercise: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { ExerciseEditorPane } = await import('./exercise-editor-pane');
const { updateExerciseAction } = await import('../actions/exercise');
const { useAuthoringExercise } = await import('../api/use-authoring-exercises');
const { toast } = await import('sonner');

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

function renderPane(isLive: boolean | null = false) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ExerciseEditorPane
          kind="exercise"
          exerciseId="exercise-1"
          lessonTitle="Blandet øving"
          state="draft"
          isLive={isLive}
          container={CONTAINER}
          backHref="/school/my-school/content/course-1"
          publishSlot={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(toast.success).mockReset();
  vi.mocked(updateExerciseAction).mockReset();
  vi.mocked(updateExerciseAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useAuthoringExercise).mockReturnValue({
    data: {
      id: 'exercise-1',
      exerciseTemplateId: 'tpl-mcq',
      templateCode: 'multiple_choice',
      targetLanguage: 'no',
      difficultyLevel: 'A2',
      content: {
        question: 'Hva heter du?',
        options: [
          { id: 'opt-0', text: 'Ja' },
          { id: 'opt-1', text: 'Nei' },
          { id: 'opt-2', text: 'Kanskje' },
        ],
      },
      expectedAnswers: { correct_option_ids: ['opt-0'] },
      instructions: [{ instructionLanguage: 'en', instructionText: 'Choose the correct answer.' }],
    },
    isLoading: false,
  } as never);
});

describe('ExerciseEditorPane', () => {
  it('renders the loaded multiple-choice content in both the editor and the live preview', () => {
    renderPane();
    expect(screen.getByDisplayValue('Hva heter du?')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Ja')).toHaveLength(1);
    expect(screen.getByText('Ja')).toBeInTheDocument();
  });

  it('saves edits via updateExerciseAction on submit', async () => {
    renderPane();

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateExerciseAction).toHaveBeenCalledWith(
        'exercise-1',
        'module-1',
        expect.objectContaining({ templateCode: 'multiple_choice', mcQuestion: 'Hvor bor du?' }),
      );
    });
  });

  it('refuses to save an exercise whose instruction was cleared', async () => {
    // An exercise with no instruction row is a publish blocker
    // (`EXERCISE_INCOMPLETE`), discovered only on the review screen — so the
    // editor refuses the save instead.
    renderPane();

    fireEvent.change(screen.getByDisplayValue('Choose the correct answer.'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
    expect(updateExerciseAction).not.toHaveBeenCalled();
  });

  it('updates the live preview as the author edits the question', async () => {
    renderPane();

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });

    await waitFor(() => {
      expect(screen.getByText('Hvor bor du?')).toBeInTheDocument();
    });
  });
  it('warns that saves on live material reach students at once', () => {
    renderPane(true);
    expect(screen.getByText('Live — students see every save immediately.')).toBeInTheDocument();
  });

  it('says a save on unreleased material stays in the draft', () => {
    renderPane(false);
    expect(
      screen.getByText('Not live yet — students see this material once the module is published.'),
    ).toBeInTheDocument();
  });

  it('confirms a save on live material as already visible to students', async () => {
    renderPane(true);

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Exercise saved.', {
        description: 'Students see this change now.',
      }),
    );
  });

  it('confirms a save on unreleased material as pending a publish', async () => {
    renderPane(false);

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Exercise saved.', {
        description: 'Saved to the draft — publish the module to release it.',
      }),
    );
  });
});
