import { screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

const bulkMutate = vi.fn();

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return { ...actual, useBulkIntroduceFromList: () => ({ mutate: bulkMutate, isPending: false }) };
});
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { VocabDoneStage } = await import('./vocab-done-stage');

function renderStage(overrides: Partial<React.ComponentProps<typeof VocabDoneStage>> = {}) {
  return renderWithProviders(
    <VocabDoneStage
      knownCount={1}
      learnedCount={3}
      srsVocabDue={0}
      onRestart={vi.fn()}
      vocabularyListId="list-1"
      pendingCount={3}
      onAdded={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => bulkMutate.mockReset());

describe('VocabDoneStage — study set', () => {
  it('offers the words that are not in the study set yet', () => {
    renderStage();

    expect(screen.getByText('3 words are not in your study set yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to study set/i })).toBeInTheDocument();
  });

  it('hands the list over only when the learner asks for it', () => {
    const onAdded = vi.fn();
    bulkMutate.mockImplementation((_input, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    renderStage({ onAdded });

    // Nothing is scheduled by having read the words — the add is the decision.
    expect(bulkMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /add to study set/i }));

    // No seedKind: these are words being met for the first time, not claimed as known.
    expect(bulkMutate).toHaveBeenCalledWith({ vocabularyListId: 'list-1' }, expect.anything());
    expect(onAdded).toHaveBeenCalled();
  });

  it('says so instead when every word is already in the set', () => {
    renderStage({ pendingCount: 0 });

    expect(screen.getByText('Every word here is already in your study set.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to study set/i })).not.toBeInTheDocument();
  });

  // A failed lookup must not turn into "everything is already in" — the offer stands,
  // only the count is dropped.
  it('still offers the add when the study set is unknown', () => {
    renderStage({ pendingCount: null });

    expect(screen.getByText('Add these words to your study set')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to study set/i })).toBeInTheDocument();
    expect(
      screen.queryByText('Every word here is already in your study set.'),
    ).not.toBeInTheDocument();
  });
});
