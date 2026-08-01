import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { ExerciseWithAnswers } from '@/features/content/types';
import { ExercisePage } from './exercise-page';

const useExerciseWithAnswers = vi.fn();
vi.mock('@/features/content/api/use-exercise', () => ({
  useExerciseWithAnswers: (id: string) => useExerciseWithAnswers(id),
}));

// Stub the learning barrel — its transitive imports pull in next/navigation,
// which isn't resolvable in the unit test environment.
vi.mock('@/features/learning', () => ({
  ErrorState: () => <div>error</div>,
  LearningSkeleton: () => <div>loading</div>,
}));

function mockExercise(exercise: Partial<ExerciseWithAnswers> & Pick<ExerciseWithAnswers, 'templateCode'>) {
  useExerciseWithAnswers.mockReturnValue({
    data: {
      id: 'e1',
      targetLanguage: 'nb',
      content: {},
      expectedAnswers: {},
      instructions: null,
      ...exercise,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => useExerciseWithAnswers.mockReset());

describe('ExercisePage', () => {
  it('grades a correct multiple_choice answer', () => {
    mockExercise({
      templateCode: 'multiple_choice',
      content: { question: 'Hvilket ord betyr hei?', options: [{ id: 'a', text: 'hei' }, { id: 'b', text: 'takk' }] },
      expectedAnswers: { correct_option_ids: ['a'] },
    });
    renderWithProviders(<ExercisePage exerciseId="e1" />);

    fireEvent.click(screen.getByText('hei'));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });

  it('marks a wrong multiple_choice answer as incorrect', () => {
    mockExercise({
      templateCode: 'multiple_choice',
      content: { question: 'Q?', options: [{ id: 'a', text: 'hei' }, { id: 'b', text: 'takk' }] },
      expectedAnswers: { correct_option_ids: ['a'] },
    });
    renderWithProviders(<ExercisePage exerciseId="e1" />);

    fireEvent.click(screen.getByText('takk'));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Not quite')).toBeInTheDocument();
  });

  it('routes a short_answer with no accepted match to review', () => {
    mockExercise({
      templateCode: 'short_answer',
      content: { question: 'Når hørte Anne nyheten?' },
      expectedAnswers: { reference_answer: 'På radio.', accepted_answers: ['på radio'] },
    });
    renderWithProviders(<ExercisePage exerciseId="e1" />);

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'noe helt annet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    // ok === null → "Answer submitted" (review) banner.
    expect(screen.getByText('Answer submitted')).toBeInTheDocument();
  });

  it('auto-grades a short_answer that matches an accepted answer', () => {
    mockExercise({
      templateCode: 'short_answer',
      content: { question: 'Q?' },
      expectedAnswers: { reference_answer: 'På radio.', accepted_answers: ['på radio'] },
    });
    renderWithProviders(<ExercisePage exerciseId="e1" />);

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'På radio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });

  describe('word_bank_fill', () => {
    const wordBankExercise = {
      templateCode: 'word_bank_fill',
      content: {
        word_bank: ['show off', 'boast'],
        items: [
          { id: '1', text_with_blanks: 'I hate it when people ___1___ all the time.' },
          { id: '2', text_with_blanks: 'They ___1___ about their car.' },
        ],
      },
      expectedAnswers: {
        items: [
          { id: '1', blanks: [{ blank_id: 1, accepted_answers: ['show off'] }] },
          { id: '2', blanks: [{ blank_id: 1, accepted_answers: ['boast'] }] },
        ],
      },
    };

    it('checks only once every blank is filled', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      const check = screen.getByRole('button', { name: 'Check' });
      expect(check).toBeDisabled();

      fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'show off' } });
      expect(check).toBeDisabled();

      fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'boast' } });
      expect(check).toBeEnabled();
    });

    it('grades every sentence and reports the tally when some are wrong', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'show off' } });
      fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'show off' } });
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByText('Not quite')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 blanks correct')).toBeInTheDocument();
    });

    it('is correct when every blank matches', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'show off' } });
      fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'boast' } });
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByText('Correct')).toBeInTheDocument();
    });
  });

  it('shows an unsupported message for an unknown template', () => {
    mockExercise({ templateCode: 'mystery_type' });
    renderWithProviders(<ExercisePage exerciseId="e1" />);
    expect(screen.getByText(/isn.t playable yet/i)).toBeInTheDocument();
  });
});
