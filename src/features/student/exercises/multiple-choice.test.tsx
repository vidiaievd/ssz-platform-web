import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { ExerciseDisplay } from '@/features/content/types';
import { MultipleChoiceExercise } from './multiple-choice';

vi.mock('../actions/submit-attempt', () => ({
  submitAttemptAction: vi.fn(),
}));

import { submitAttemptAction } from '../actions/submit-attempt';

const mockSubmit = vi.mocked(submitAttemptAction);

const EXERCISE: ExerciseDisplay = {
  id: 'ex-mc-1',
  templateCode: 'multiple_choice',
  targetLanguage: 'nb',
  difficultyLevel: 'A1',
  instructions: 'Pick the correct answer.',
  content: {
    question: 'What colour is the sky?',
    options: ['Red', 'Blue', 'Green'],
    correctIndex: 1,
    explanation: 'Due to Rayleigh scattering.',
  },
};

describe('MultipleChoiceExercise', () => {
  it('renders the question and all options', () => {
    renderWithProviders(<MultipleChoiceExercise exercise={EXERCISE} />);

    expect(screen.getByText('What colour is the sky?')).toBeInTheDocument();
    expect(screen.getByText(/Red/)).toBeInTheDocument();
    expect(screen.getByText(/Blue/)).toBeInTheDocument();
    expect(screen.getByText(/Green/)).toBeInTheDocument();
  });

  it('renders the instructions', () => {
    renderWithProviders(<MultipleChoiceExercise exercise={EXERCISE} />);
    expect(screen.getByText('Pick the correct answer.')).toBeInTheDocument();
  });

  it('enables the submit button only after selecting an option', () => {
    renderWithProviders(<MultipleChoiceExercise exercise={EXERCISE} />);
    const submit = screen.getByRole('button', { name: /check answer/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(submit).not.toBeDisabled();
  });

  it('shows correct feedback after a correct answer', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      value: { verdict: 'correct', canRetry: false },
    });

    renderWithProviders(<MultipleChoiceExercise exercise={EXERCISE} />);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/correct/i);
  });

  it('shows incorrect feedback and Try Again after a wrong answer', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      value: {
        verdict: 'incorrect',
        correctAnswer: 'Blue',
        explanation: 'Due to Rayleigh scattering.',
        canRetry: true,
      },
    });

    renderWithProviders(<MultipleChoiceExercise exercise={EXERCISE} />);
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/incorrect/i);
    expect(screen.getByRole('status')).toHaveTextContent('Blue');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('resets state when Try Again is clicked', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      value: { verdict: 'incorrect', correctAnswer: 'Blue', canRetry: true },
    });

    renderWithProviders(<MultipleChoiceExercise exercise={EXERCISE} />);
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    await waitFor(() => screen.getByRole('button', { name: /try again/i }));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check answer/i })).toBeDisabled();
  });
});
