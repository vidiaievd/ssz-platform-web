import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import type { InformationTransferDocument } from './edits';
import { StepDelivery } from './step-delivery';
import { Harness, PAGE_RULES, sampleDocument } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(initial: InformationTransferDocument) {
  const changes: InformationTransferDocument[] = [];
  const view = render(
    <Harness initial={initial} step={StepDelivery} onChange={(next) => changes.push(next)} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

describe('StepDelivery — how it is played (INF-B17…B21)', () => {
  it('offers a text source its visibility and no listening rules', () => {
    renderStep(sampleDocument('text'));
    expect(
      screen.getByRole('radiogroup', { name: 'The text while they fill the form' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fragment/)).toBeNull();
  });

  it('blocks a hidden written source', async () => {
    const { user, last } = renderStep(sampleDocument('text'));
    await user.click(screen.getByRole('radio', { name: 'Hidden while answering' }));
    expect(last().answering.showSource).toBe('afterAnswer');
    expect(screen.getByText(/fill the form from memory/)).toBeInTheDocument();
  });

  it('gives a recording the layer’s rules card and the fragments tip, not the visibility', () => {
    renderStep(sampleDocument('audio'));
    expect(
      screen.queryByRole('radiogroup', { name: 'The text while they fill the form' }),
    ).toBeNull();
    expect(screen.getByText(/play the fragment/)).toBeInTheDocument();
  });

  it('keeps the numeric settings numbers in the document', async () => {
    const { user, last } = renderStep(sampleDocument());
    await user.click(screen.getByRole('radio', { name: 'Unlimited' }));
    expect(last().answering.attempts).toBe(0);
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Hints on the cells' })).getByRole('radio', {
        name: 'Never',
      }),
    );
    expect(last().answering.hintsAfter).toBe(9);
    await user.click(screen.getByRole('radio', { name: 'With the verdict' }));
    expect(last().answering.revealKey).toBe('immediately');
  });

  it('counts the ready cells in the one-at-a-time line and writes the switch', async () => {
    const { user, last } = renderStep(sampleDocument());
    expect(screen.getByText(/walks through 6 cells one by one/)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /One cell at a time/ }));
    expect(last().answering.oneAtATime).toBe(true);
  });

  it('warns that one playback is a memory test for a crowded form', () => {
    const doc = sampleDocument('audio');
    doc.audio = { ...doc.audio, settings: { ...doc.audio.settings, plays: 1 } };
    renderStep(doc);
    expect(screen.getByText(/One playback for 6 cells is a memory test/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleDocument('audio'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
