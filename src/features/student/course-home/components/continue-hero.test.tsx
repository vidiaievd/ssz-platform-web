import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ContinueHero, deriveContinueScenario } from './continue-hero';

const modules = [
  { moduleId: 'm1', status: 'in_progress' },
  { moduleId: 'm2', status: 'not_started' },
] as Parameters<typeof deriveContinueScenario>[0]['modules'];

describe('deriveContinueScenario', () => {
  it('asks a learner to go on in a course they are studying', () => {
    expect(deriveContinueScenario({ overdueAssignmentCount: 0, srsDueCount: 0, modules })).toBe('resume');
  });

  it('only offers reading in a course kept as history, whatever else is due', () => {
    expect(deriveContinueScenario({ overdueAssignmentCount: 2, srsDueCount: 40, modules, historyOnly: true })).toBe('history');
  });
});

describe('ContinueHero', () => {
  it('words a history course as reading, not continuing', () => {
    renderWithProviders(<ContinueHero scenario="history" ctaHref="/x" />);
    expect(screen.getByRole('link')).toHaveTextContent('Read the lessons');
    expect(screen.queryByText(/Continue/)).toBeNull();
  });
});
