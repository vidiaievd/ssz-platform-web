import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { ExerciseWithAnswers } from '@/features/content/types';
import { ExercisePage } from './exercise-page';

const useExerciseWithAnswers = vi.fn();
vi.mock('@/features/content/api/use-exercise', () => ({
  useExerciseWithAnswers: (id: string) => useExerciseWithAnswers(id),
}));

// The new-form runner drives its own attempt against the engine; this page's business
// is only which of the two runners a short_answer document is sent to.
vi.mock('./short-answer-solver', () => ({
  ShortAnswerSolver: () => <div>server-graded short answer</div>,
}));

// Stub the learning barrel — its transitive imports pull in next/navigation,
// which isn't resolvable in the unit test environment.
vi.mock('@/features/learning', () => ({
  ErrorState: () => <div>error</div>,
  LearningSkeleton: () => <div>loading</div>,
}));

function mockExercise(
  exercise: Partial<ExerciseWithAnswers> & Pick<ExerciseWithAnswers, 'templateCode'>,
) {
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
      content: {
        question: 'Hvilket ord betyr hei?',
        options: [
          { id: 'a', text: 'hei' },
          { id: 'b', text: 'takk' },
        ],
      },
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
      content: {
        question: 'Q?',
        options: [
          { id: 'a', text: 'hei' },
          { id: 'b', text: 'takk' },
        ],
      },
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

  it('sends a short_answer of the new form to the server-graded runner', () => {
    mockExercise({
      templateCode: 'short_answer',
      // `questions` is what the two live forms are told apart by — the old one has a
      // single `question` and could never grow the field (plan 51 §8 Q1).
      content: {
        instruction: 'Svar med egne ord.',
        questions: [{ id: 'sa1', kind: 'reading', prompt: 'Hvor lenge?' }],
        settings: {},
      },
      expectedAnswers: {},
    });
    renderWithProviders(<ExercisePage exerciseId="e1" />);

    expect(screen.getByText('server-graded short answer')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
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

    /** Arms the nth blank, then taps a bank word into it. */
    const fillBlank = (n: number, word: string) => {
      fireEvent.click(screen.getAllByRole('button', { name: /Blank in sentence/ })[n]!);
      fireEvent.click(
        within(screen.getByRole('group', { name: 'Word bank' })).getByRole('button', {
          name: new RegExp(word),
        }),
      );
    };

    it('checks only once every blank is filled', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      const check = screen.getByRole('button', { name: 'Check' });
      expect(check).toBeDisabled();

      fillBlank(0, 'show off');
      expect(check).toBeDisabled();

      fillBlank(1, 'boast');
      expect(check).toBeEnabled();
    });

    it('grades every sentence and reports the tally when some are wrong', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      fillBlank(0, 'show off');
      fillBlank(1, 'show off');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByText('Not quite')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 blanks correct')).toBeInTheDocument();
    });

    it('keeps the right answers and empties only the misses on a retry', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      fillBlank(0, 'show off'); // right
      fillBlank(1, 'show off'); // wrong, expects "boast"
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      const blanks = screen.getAllByRole('button', { name: /Blank in sentence/ });
      expect(blanks[0]).toHaveTextContent('show off');
      expect(blanks[1]).toHaveTextContent('Choose…');
      expect(screen.getByText(/1 of 2 blanks filled/)).toBeInTheDocument();
    });

    it('is correct when every blank matches', () => {
      mockExercise(wordBankExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      fillBlank(0, 'show off');
      fillBlank(1, 'boast');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByText('Correct')).toBeInTheDocument();
    });
  });

  describe('text_order', () => {
    const orderExercise = {
      templateCode: 'text_order',
      content: {
        kind: 'dialogue',
        items: [
          { id: 'a', text: 'Hi, I am Marina.' },
          { id: 'b', text: 'Nice to meet you.' },
          { id: 'c', text: 'See you around!' },
        ],
      },
      expectedAnswers: { order: ['a', 'b', 'c'] },
    };

    /** Drags nothing — reorders through the per-line move buttons. */
    function currentOrder() {
      return screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    }

    it('starts shuffled rather than in the expected order', () => {
      mockExercise(orderExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      expect(currentOrder()[0]).not.toContain('Hi, I am Marina.');
    });

    it('grades the arrangement the learner leaves behind', () => {
      mockExercise(orderExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      // Whatever the shuffle produced, sort it back with the move-up buttons.
      const wanted = ['Hi, I am Marina.', 'Nice to meet you.', 'See you around!'];
      for (let target = 0; target < wanted.length; target++) {
        for (;;) {
          const at = currentOrder().findIndex((text) => text.includes(wanted[target]!));
          if (at <= target) break;
          const item = screen.getAllByRole('listitem')[at]!;
          fireEvent.click(within(item).getByLabelText('Move up'));
        }
      }

      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      expect(screen.getByText('Correct')).toBeInTheDocument();
    });

    it('reports how many lines landed right when the order is wrong', () => {
      mockExercise(orderExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      fireEvent.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByText('Not quite')).toBeInTheDocument();
      expect(screen.getByText(/of 3 lines in the right place/)).toBeInTheDocument();
    });
  });

  describe('second attempt', () => {
    const fillExercise: Partial<ExerciseWithAnswers> & Pick<ExerciseWithAnswers, 'templateCode'> = {
      templateCode: 'fill_in_blank',
      content: { text_with_blanks: 'Han sier ___1___ han er sliten.' },
      expectedAnswers: {
        blanks: [{ blank_id: 1, accepted_answers: ['at'] }],
        explanation: 'Statements take «at».',
      },
      instructions: [
        {
          id: 'i1',
          exerciseId: 'e1',
          instructionLanguage: 'ru',
          instructionText: 'Fill the gap.',
          hintText: 'A statement, not a question.',
        },
      ],
    };

    const answer = (word: string) => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: word } });
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    };

    it('offers a retry with the hint instead of the answer on a first miss', () => {
      mockExercise(fillExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);
      answer('om');

      expect(screen.getByText('Not quite')).toBeInTheDocument();
      expect(screen.getByText('A statement, not a question.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      // neither the answer nor the rule that names it
      expect(screen.queryByText(/Answer:/)).not.toBeInTheDocument();
      expect(screen.queryByText('Statements take «at».')).not.toBeInTheDocument();
    });

    it('hands back an empty blank to answer again', () => {
      mockExercise(fillExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);
      answer('om');

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      const input = screen.getByRole('textbox');
      expect(input).toBeEnabled();
      // The one blank here was the miss, so it starts over empty.
      expect(input).toHaveValue('');
      expect(screen.queryByText('Not quite')).not.toBeInTheDocument();
    });

    it('keeps both offers standing on every further miss', () => {
      mockExercise(fillExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);

      for (const wrong of ['om', 'hvorfor', 'hva']) {
        answer(wrong);
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument();
        // no attempt count quietly spoils the answer
        expect(screen.queryByText(/Answer:/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      }
    });

    it('shows the answer in the sentence on request and hides it again', () => {
      mockExercise(fillExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);
      answer('om');

      fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
      expect(screen.getByText(/Answer:/)).toBeInTheDocument();
      expect(screen.getByText('Statements take «at».')).toBeInTheDocument();
      expect(screen.getByText('om').tagName).toBe('S');

      fireEvent.click(screen.getByRole('button', { name: 'Hide answers' }));
      expect(screen.queryByText(/Answer:/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument();
    });

    it('hides the answer again when a new attempt starts', () => {
      mockExercise(fillExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);
      answer('om');
      fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      answer('hvorfor');

      expect(screen.queryByText(/Answer:/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument();
    });

    it('offers no retry once the answer is right', () => {
      mockExercise(fillExercise);
      renderWithProviders(<ExercisePage exerciseId="e1" />);
      answer('at');

      expect(screen.getByText('Correct')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      expect(screen.getByText('Statements take «at».')).toBeInTheDocument();
    });
  });

  it('shows an unsupported message for an unknown template', () => {
    mockExercise({ templateCode: 'mystery_type' });
    renderWithProviders(<ExercisePage exerciseId="e1" />);
    expect(screen.getByText(/isn.t playable yet/i)).toBeInTheDocument();
  });
});
