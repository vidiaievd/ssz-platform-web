import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import type { InformationTransferDocument } from './edits';
import { Intl, PAGE_RULES, blankDocument, sampleDocument } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

const { InformationTransferBuilder } = await import('./builder');

function draw(
  initial: InformationTransferDocument,
  onDocumentChange?: (d: InformationTransferDocument) => void,
) {
  const view = render(
    <Intl>
      <InformationTransferBuilder
        initialExercise={initial}
        {...(onDocumentChange === undefined ? {} : { onDocumentChange })}
      />
    </Intl>,
  );
  return { user: userEvent.setup(), ...view };
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('InformationTransferBuilder — the rail and steps 1–2 (INF-B1)', () => {
  it('lists the five steps with their sub-lines', () => {
    draw(sampleDocument());
    for (const label of [
      /Source.*text or recording/,
      /Blank.*the fields/,
      /Answers.*what counts as right/,
      /Delivery.*how it is played/,
      /Result.*scoring and memory/,
    ]) {
      expect(tab(label)).toBeInTheDocument();
    }
  });

  it('shows a blank draft its blockers on the rail from the first mount — steps 1 and 2', () => {
    draw(blankDocument());
    expect(tab(/^1\s*Source/)).toHaveTextContent(/1 problem/);
    expect(tab(/^2\s*Blank/)).toHaveTextContent(/problem/);
  });

  it('shows a finished recording with no blockers on steps 1 and 2', () => {
    draw(sampleDocument('audio'));
    expect(tab(/^1\s*Source/)).not.toHaveTextContent(/problem/);
    expect(tab(/^2\s*Blank/)).not.toHaveTextContent(/problem/);
  });

  it('walks forward and back with the foot of the step', async () => {
    const { user } = draw(sampleDocument());
    expect(screen.getByRole('heading', { name: 'The source' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Blank/ }));
    expect(screen.getByRole('heading', { name: 'The blank' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('heading', { name: 'The source' })).toBeInTheDocument();
  });

  it('reports every edit to the page', async () => {
    const seen: InformationTransferDocument[] = [];
    const { user } = draw(blankDocument(), (d) => seen.push(d));
    await user.type(screen.getByLabelText(/^Title/), 'Skjema');
    expect(seen.at(-1)?.title).toBe('Skjema');
    // The rail follows: the title warning is gone from step 1's own list.
    expect(within(screen.getByRole('tablist')).getByText(/Source/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = draw(sampleDocument('audio'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
