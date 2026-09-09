import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { ExerciseAxes } from '../types';

const useExerciseAxes = vi.fn();
const mutateAsync = vi.fn();
vi.mock('../api/use-exercise-axes', () => ({
  useExerciseAxes: (...args: unknown[]) => useExerciseAxes(...args),
  useSetExerciseAxes: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ExerciseAxesPanel } = await import('./exercise-axes-panel');

const DERIVED: ExerciseAxes = {
  skills: ['reading'],
  focus: ['vocabulary'],
  form: 'bank',
  skillSource: 'template',
  focusSource: 'atoms',
};

function renderPanel(state: { data?: ExerciseAxes; isLoading?: boolean; isError?: boolean }) {
  useExerciseAxes.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  });

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ExerciseAxesPanel exerciseId="exercise-1" containerId="module-1" />
    </NextIntlClientProvider>,
  );
}

const chip = (name: string) => screen.getByRole('button', { name });

describe('ExerciseAxesPanel', () => {
  beforeEach(() => {
    useExerciseAxes.mockReset();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue(DERIVED);
  });

  it('says what the exercise trains and where each answer came from', () => {
    renderPanel({ data: DERIVED });

    expect(chip('Reading')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Listening')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Worked out from the exercise type.')).toBeInTheDocument();
    expect(
      screen.getByText('From the words and rules linked to this exercise.'),
    ).toBeInTheDocument();
  });

  it('offers nothing to save until the author changes something', () => {
    renderPanel({ data: DERIVED });

    expect(screen.getByRole('button', { name: 'Save what it trains' })).toBeDisabled();
  });

  it('sends both axes when only the skill was corrected', async () => {
    // One marker covers the pair, so a half-override is not a state that exists: the
    // derived focus goes back unchanged and the author owns both from now on.
    renderPanel({ data: DERIVED });

    await userEvent.click(chip('Listening'));
    await userEvent.click(screen.getByRole('button', { name: 'Save what it trains' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      skills: ['listening', 'reading'],
      focus: ['vocabulary'],
    });
  });

  it('keeps an empty selection saveable, and says what saving it would mean', async () => {
    renderPanel({ data: DERIVED });

    await userEvent.click(chip('Reading'));
    await userEvent.click(chip('Vocabulary'));

    expect(screen.getByText(/counts towards nothing at all/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save what it trains' }));
    expect(mutateAsync).toHaveBeenCalledWith({ skills: [], focus: [] });
  });

  it('offers the withdrawal only where there is an override to withdraw', () => {
    renderPanel({ data: DERIVED });
    expect(screen.queryByRole('button', { name: 'Back to derived' })).not.toBeInTheDocument();
  });

  it('withdraws with null, which is a different act from saving an empty pair', async () => {
    renderPanel({ data: { ...DERIVED, skills: ['listening'], skillSource: 'override' } });

    await userEvent.click(screen.getByRole('button', { name: 'Back to derived' }));

    expect(mutateAsync).toHaveBeenCalledWith(null);
  });

  it('shows the derived value the withdrawal answered with, not the selection it replaced', async () => {
    // The mutation writes the server's answer into the cache, so the panel drops its own
    // draft and reads it back — this stands in for that write.
    renderPanel({ data: { ...DERIVED, skills: ['listening'], skillSource: 'override' } });
    mutateAsync.mockImplementationOnce(() => {
      useExerciseAxes.mockReturnValue({ data: DERIVED, isLoading: false, isError: false });
      return Promise.resolve(DERIVED);
    });

    await userEvent.click(chip('Writing'));
    await userEvent.click(screen.getByRole('button', { name: 'Back to derived' }));

    expect(chip('Reading')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Listening')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Writing')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports a failed read instead of an empty set of axes', () => {
    renderPanel({ isError: true });

    expect(screen.getByText('Could not read what this exercise trains.')).toBeInTheDocument();
  });
});
