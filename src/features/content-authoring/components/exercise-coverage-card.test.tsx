import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ExerciseAxes } from '../types';

vi.mock('../api/use-exercise-axes', () => ({
  useExerciseAxes: vi.fn(),
  useSetExerciseAxes: vi.fn(),
}));
vi.mock('./exercise-axes-panel', () => ({
  ExerciseAxesPanel: ({ exerciseId }: { exerciseId: string }) => (
    <div data-testid="axes-panel" data-exercise={exerciseId} />
  ),
}));

const { ExerciseCoverageCard } = await import('./exercise-coverage-card');
const { useExerciseAxes } = await import('../api/use-exercise-axes');

function renderCard({
  templateCode = 'short_answer',
  document = {} as unknown,
  axes,
}: {
  templateCode?: string;
  document?: unknown;
  axes?: ExerciseAxes;
} = {}) {
  vi.mocked(useExerciseAxes).mockReturnValue({ data: axes } as never);
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ExerciseCoverageCard
        exerciseId="ex-1"
        containerId="course-1"
        templateCode={templateCode}
        document={document}
      />
    </NextIntlClientProvider>,
  );
}

describe('ExerciseCoverageCard', () => {
  it('says what the exercise trains and where the answer came from', () => {
    renderCard();

    expect(screen.getByText('What this exercise trains')).toBeInTheDocument();
    expect(screen.getByText('Reading, Writing')).toBeInTheDocument();
    expect(screen.getAllByText('Worked out from the exercise type.').length).toBeGreaterThan(0);
  });

  // The complaint the phase answers: the number used to agree with the document
  // only after a save.
  it('follows the document in hand rather than the one last saved', () => {
    renderCard({ document: { audio: { enabled: true } } });

    // Criterion 9: heard *and* written, without a save in between.
    expect(screen.getByText('Listening, Writing')).toBeInTheDocument();
    expect(screen.getByText('From a setting inside the exercise itself.')).toBeInTheDocument();
  });

  it('keeps the panel behind a button, because the derivation is usually right', () => {
    renderCard();

    expect(screen.queryByTestId('axes-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refine' }));
    expect(screen.getByTestId('axes-panel')).toHaveAttribute('data-exercise', 'ex-1');
  });

  it('shows what the author declared instead of what the draft would say', () => {
    renderCard({
      document: { audio: { enabled: true } },
      axes: {
        skills: ['spoken'],
        focus: ['pragmatics'],
        form: 'free',
        skillSource: 'override',
        focusSource: 'override',
      },
    });

    expect(screen.getByText('Speaking')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
    expect(screen.getAllByText('You set this yourself.').length).toBe(2);
  });
});
