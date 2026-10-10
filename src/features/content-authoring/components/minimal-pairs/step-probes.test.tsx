import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import type { MinimalPairsDocument } from './edits';
import { StepProbes } from './step-probes';
import { blankDocument, Harness, PAGE_RULES, sampleMinimalPairs } from './test-support';

function renderStep(initial: MinimalPairsDocument) {
  const changes: MinimalPairsDocument[] = [];
  const view = render(
    <Harness initial={initial} onChange={(next) => changes.push(next)} step={StepProbes} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

describe('StepProbes — the count (MP-B17)', () => {
  it('draws the figure, the pool it is counted against and the 8–15 band over the 20-probe scale', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByText('from 9 words')).toBeInTheDocument();
    expect(screen.getByText('8–15 is the working band')).toBeInTheDocument();
    const band = screen.getByTestId('mp-band');
    expect(band).toHaveStyle({ left: '40%', width: '35%' });
    expect(screen.getByRole('meter', { name: 'Probes against the scale of 20' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    );
  });

  it('writes the number through the kernel, clamped to 2–30', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    const field = screen.getByRole('spinbutton', { name: 'Number of probes' });
    await user.clear(field);
    await user.type(field, '99');
    expect(last().set.probes).toBe(30);
    await user.clear(field);
    await user.type(field, '1');
    expect(last().set.probes).toBe(2);
  });

  it('says when the count leaves the band, from the kernel’s issues', () => {
    const doc = sampleMinimalPairs();
    renderStep({ ...doc, set: { ...doc.set, probes: 5 } });
    expect(screen.getByText(/5 probes\. Under 8/)).toBeInTheDocument();
  });
});

describe('StepProbes — how they are drawn (MP-B18, MP-B19)', () => {
  it('switches the sampling, and only «weakest first» brings the tip', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    expect(screen.queryByText(/over-samples/)).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Weakest first' }));
    expect(last().set.sampling).toBe('weakest');
    expect(screen.getByText(/over-samples the words they have missed/)).toBeInTheDocument();
    expect(screen.getByText('contrast:kjsj')).toBeInTheDocument();
  });

  it('reads the run limit into the balanced hint', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByText(/more than 2 times in a row/)).toBeInTheDocument();
  });

  it('maps the replay buttons onto 1, 2, 3 and 0 for unlimited', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    const group = screen.getByRole('radiogroup', { name: 'Replays per probe' });
    expect(within(group).getByRole('radio', { name: '2' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Unlimited' }));
    expect(last().set.playsPerProbe).toBe(0);
    await user.click(within(group).getByRole('radio', { name: '3' }));
    expect(last().set.playsPerProbe).toBe(3);
  });

  it('switches what the buttons hold', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('radio', { name: 'All words in the set' }));
    expect(last().set.options).toBe('all');
  });

  it('flips the three switches, and names the pool in the repeat help', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    expect(screen.getByText('Off caps the set at 9 probes — one per word.')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Play by itself/ }));
    expect(last().set.autoplay).toBe(false);
    await user.click(screen.getByRole('switch', { name: /come up more than once/ }));
    expect(last().set.allowRepeat).toBe(false);
    await user.click(screen.getByRole('switch', { name: /Shuffle the buttons/ }));
    expect(last().set.shuffleOptions).toBe(false);
  });
});

describe('StepProbes — one draw (MP-B20)', () => {
  const cells = () =>
    within(screen.getByRole('list', { name: 'One draw' })).getAllByRole('listitem');

  it('shows as many cells as probes, numbered, each a word of the set', () => {
    renderStep(sampleMinimalPairs());
    const found = cells();
    expect(found).toHaveLength(12);
    expect(found[0]).toHaveTextContent(/^1\S/);
  });

  it('draws again to another order, deterministically', async () => {
    const { user } = renderStep(sampleMinimalPairs());
    const before = cells().map((c) => c.textContent);
    await user.click(screen.getByRole('button', { name: 'Draw again' }));
    const after = cells().map((c) => c.textContent);
    expect(after).not.toEqual(before);
    await user.click(screen.getByRole('button', { name: 'Draw again' }));
    expect(cells()).toHaveLength(12);
  });

  it('says there is nothing to draw while no pair has two words with audio', () => {
    renderStep(blankDocument());
    expect(screen.getByText('Nothing to draw')).toBeInTheDocument();
    expect(screen.getByText('No pair has two words with audio yet.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleMinimalPairs());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
