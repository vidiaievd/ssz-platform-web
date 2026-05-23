import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { ExerciseDisplay } from '@/features/content/types';
import { ClozeExercise } from './cloze';

vi.mock('../actions/submit-attempt', () => ({
  submitAttemptAction: vi.fn(),
}));

import { submitAttemptAction } from '../actions/submit-attempt';

const mockSubmit = vi.mocked(submitAttemptAction);

const EXERCISE: ExerciseDisplay = {
  id: 'ex-cloze-1',
  templateCode: 'cloze',
  targetLanguage: 'nb',
  difficultyLevel: 'A1',
  instructions: 'Fill in the blanks.',
  content: {
    template: 'Jeg ___ til jobben med ___.',
    answers: ['sykler', 'bussen'],
    hints: ['sykler', 'bussen', 'toget'],
  },
};

describe('ClozeExercise', () => {
  it('renders the template with inputs for each blank', () => {
    renderWithProviders(<ClozeExercise exercise={EXERCISE} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAccessibleName(/blank 1/i);
    expect(inputs[1]).toHaveAccessibleName(/blank 2/i);
  });

  it('renders hints', () => {
    renderWithProviders(<ClozeExercise exercise={EXERCISE} />);
    expect(screen.getByText('sykler')).toBeInTheDocument();
    expect(screen.getByText('bussen')).toBeInTheDocument();
    expect(screen.getByText('toget')).toBeInTheDocument();
  });

  it('disables the submit button until all blanks are filled', () => {
    renderWithProviders(<ClozeExercise exercise={EXERCISE} />);
    const submit = screen.getByRole('button', { name: /check answer/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'sykler' } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getAllByRole('textbox')[1]!, { target: { value: 'bussen' } });
    expect(submit).not.toBeDisabled();
  });

  it('shows correct feedback after a fully correct attempt', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      value: { verdict: 'correct', canRetry: false },
    });

    renderWithProviders(<ClozeExercise exercise={EXERCISE} />);
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'sykler' } });
    fireEvent.change(screen.getAllByRole('textbox')[1]!, { target: { value: 'bussen' } });
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/correct/i);
  });

  it('shows partial feedback and Try Again after a partial attempt', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      value: {
        verdict: 'partial',
        correctAnswer: ['sykler', 'bussen'],
        canRetry: true,
      },
    });

    renderWithProviders(<ClozeExercise exercise={EXERCISE} />);
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'sykler' } });
    fireEvent.change(screen.getAllByRole('textbox')[1]!, { target: { value: 'toget' } });
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/partially correct/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('resets inputs when Try Again is clicked', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      value: { verdict: 'incorrect', correctAnswer: ['sykler', 'bussen'], canRetry: true },
    });

    renderWithProviders(<ClozeExercise exercise={EXERCISE} />);
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'toget' } });
    fireEvent.change(screen.getAllByRole('textbox')[1]!, { target: { value: 'bilen' } });
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    await waitFor(() => screen.getByRole('button', { name: /try again/i }));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('');
    expect(inputs[1]).toHaveValue('');
  });
});
