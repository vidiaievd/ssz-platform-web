import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { UnitContentsItem } from '@/features/learning';

import { PracticePage } from './practice-page';

const useExerciseForRunner = vi.fn();
vi.mock('@/features/content/api/use-exercise', () => ({
  useExerciseForRunner: (id: string) => useExerciseForRunner(id),
}));

// See exercise-page.test.tsx: the learning barrel pulls in next/navigation.
vi.mock('@/features/learning', () => ({
  ErrorState: () => <div>error</div>,
  LearningSkeleton: () => <div>loading</div>,
}));

// The set runner opens an attempt of its own the moment it mounts, which is the very
// thing the folded card exists to postpone — so the stub reports whether it was
// mounted at all, and how.
vi.mock('./short-answer-solver', () => ({
  ShortAnswerSolver: ({ stacked }: { stacked?: boolean }) => (
    <div>set runner{stacked === true ? ' (stacked)' : ''}</div>
  ),
}));

/** Every exercise resolves to the same one-option MCQ — enough to click Check. */
function mockMcq() {
  useExerciseForRunner.mockImplementation((id: string) => ({
    data: {
      id,
      templateCode: 'multiple_choice',
      targetLanguage: 'nb',
      content: {
        question: `Question ${id}`,
        options: [
          { id: 'a', text: 'hei' },
          { id: 'b', text: 'takk' },
        ],
      },
      expectedAnswers: { correct_option_ids: ['a'] },
      instructions: null,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }));
}

/** A `short_answer` set of the new form: several questions, graded on the server. */
function mockSet() {
  useExerciseForRunner.mockImplementation((id: string) => ({
    data: {
      id,
      templateCode: 'short_answer',
      targetLanguage: 'nb',
      content: {
        title: 'Spørsmål til Tekst 1A',
        instruction: 'Svar med egne ord.',
        questions: [
          { id: 'q1', kind: 'reading', passage: '', prompt: 'Hvorfor?' },
          { id: 'q2', kind: 'reading', passage: '', prompt: 'Hva skjedde?' },
          { id: 'q3', kind: 'reading', passage: '', prompt: 'Når?' },
        ],
      },
      expectedAnswers: {},
      instructions: null,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }));
}

const item = (id: string): UnitContentsItem => ({
  id,
  contentType: 'EXERCISE',
  contentId: `c-${id}`,
  title: 'Multiple Choice',
  lessonKind: null,
  durationMinutes: 1,
  xpReward: 10,
  status: 'available',
});

const items = [item('e1'), item('e2'), item('e3')];

beforeEach(() => useExerciseForRunner.mockReset());

describe('PracticePage', () => {
  it('stacks every task of the section on one page, numbered', () => {
    mockMcq();
    renderWithProviders(<PracticePage title="Øvelser" items={items} />);

    expect(screen.getByRole('heading', { name: 'Øvelser' })).toBeInTheDocument();
    expect(screen.getByText('3 tasks in this set')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
    expect(screen.getByText('Question c-e2')).toBeInTheDocument();
  });

  it('reports each task once as it is checked and counts progress', () => {
    mockMcq();
    const onExerciseChecked = vi.fn();
    renderWithProviders(
      <PracticePage title="Øvelser" items={items} onExerciseChecked={onExerciseChecked} />,
    );

    expect(screen.getByText('0/3')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('hei')[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Check' })[0]!);

    expect(onExerciseChecked).toHaveBeenCalledTimes(1);
    expect(onExerciseChecked).toHaveBeenCalledWith(items[0]);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    // The other tasks stay answerable — grading is per exercise.
    expect(screen.getAllByRole('button', { name: 'Check' })).toHaveLength(2);
  });

  it('counts the tasks the server already records as done', () => {
    mockMcq();
    const seen = [{ ...items[0]!, status: 'completed' as const }, items[1]!, items[2]!];
    renderWithProviders(<PracticePage title="Øvelser" items={seen} />);

    // Progress the learner earned on an earlier visit, not a set that starts at zero
    // every time the page is opened.
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(1);
  });

  it('folds a set of questions into a card that says what it is and waits to be started', () => {
    mockSet();
    renderWithProviders(<PracticePage title="Øvelser" items={[item('e1')!]} />);

    expect(screen.getByText('Question set')).toBeInTheDocument();
    expect(screen.getByText('3 questions')).toBeInTheDocument();
    // The set's own title stands in for the missing per-learner instruction.
    expect(screen.getByText('Spørsmål til Tekst 1A')).toBeInTheDocument();
    // Nothing has been started: no attempt, no player unfolded in the stack.
    expect(screen.queryByText(/set runner/)).not.toBeInTheDocument();
  });

  it('opens the set in place, and tells it the page already draws the progress', () => {
    mockSet();
    renderWithProviders(<PracticePage title="Øvelser" items={[item('e1')!]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start · 3 questions' }));

    expect(screen.getByText('set runner (stacked)')).toBeInTheDocument();
    // The card keeps saying it is a set once open.
    expect(screen.getByText('Question set')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Start/ })).not.toBeInTheDocument();
  });

  it('does not double-count a done task that is checked again', () => {
    mockMcq();
    const seen = [{ ...items[0]!, status: 'completed' as const }, items[1]!, items[2]!];
    renderWithProviders(<PracticePage title="Øvelser" items={seen} />);

    fireEvent.click(screen.getAllByText('hei')[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Check' })[0]!);

    expect(screen.getByText('1/3')).toBeInTheDocument();
  });
});
