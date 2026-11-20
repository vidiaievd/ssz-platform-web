import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { SchoolTaskLocked } from './school-task-locked';

// Plan 90, live check block 12 (owner's decision): a draft begun before the school stopped is
// shown under the lock, read only, with a note that depends on whether the school can come back.
describe('SchoolTaskLocked', () => {
  it('shows only the lock when there is no draft', () => {
    renderWithProviders(<SchoolTaskLocked line="Skriv om byen din." draft="  " status="suspended" />);
    expect(screen.getByTestId('school-task-locked')).toBeInTheDocument();
    expect(screen.queryByTestId('school-task-locked-draft')).not.toBeInTheDocument();
  });

  it('shows the draft read only, with a hand-in later for a suspended school', () => {
    renderWithProviders(<SchoolTaskLocked draft="Jeg bor i Oslo." status="suspended" />);
    expect(screen.getByText('Jeg bor i Oslo.')).toBeInTheDocument();
    expect(screen.getByText(/once the school is unblocked/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(['closed', 'purged'] as const)('says the draft can no longer be handed in for a %s school', (status) => {
    renderWithProviders(<SchoolTaskLocked draft="Jeg bor i Oslo." status={status} />);
    expect(screen.getByText(/can no longer be handed in/)).toBeInTheDocument();
  });
});
