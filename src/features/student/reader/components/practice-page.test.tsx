import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { UnitContentsItem } from '@/features/learning';

import { PracticePage } from './practice-page';

const useExerciseWithAnswers = vi.fn();
vi.mock('@/features/content/api/use-exercise', () => ({
  useExerciseWithAnswers: (id: string) => useExerciseWithAnswers(id),
}));

// See exercise-page.test.tsx: the learning barrel pulls in next/navigation.
vi.mock('@/features/learning', () => ({
  ErrorState: () => <div>error</div>,
  LearningSkeleton: () => <div>loading</div>,
}));

/** Every exercise resolves to the same one-option MCQ — enough to click Check. */
function mockMcq() {
  useExerciseWithAnswers.mockImplementation((id: string) => ({
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

beforeEach(() => useExerciseWithAnswers.mockReset());

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
});
