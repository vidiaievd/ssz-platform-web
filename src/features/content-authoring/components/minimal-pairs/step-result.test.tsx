import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import type { MinimalPairsDocument } from './edits';
import { StepResult } from './step-result';
import { Harness, PAGE_RULES, sampleMinimalPairs } from './test-support';

function renderStep(initial: MinimalPairsDocument) {
  const changes: MinimalPairsDocument[] = [];
  const view = render(
    <Harness initial={initial} onChange={(next) => changes.push(next)} step={StepResult} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

describe('StepResult — the pass mark (MP-B23)', () => {
  it('shows the percentage and how many probes it takes, ceil(pass · probes)', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByText('9 of 12 correct')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Pass mark' })).toHaveAttribute('aria-valuenow', '75');
  });

  it('writes the mark through the kernel, clamped to 0–100', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    const field = screen.getByRole('spinbutton', { name: 'Pass mark, percent' });
    await user.clear(field);
    await user.type(field, '250');
    expect(last().scoring.passPct).toBe(100);
    await user.clear(field);
    await user.type(field, '60');
    expect(last().scoring.passPct).toBe(60);
    expect(screen.getByText('8 of 12 correct')).toBeInTheDocument();
  });

  it('warns from the kernel when the mark is so high that one mis-click fails the set', async () => {
    const { user } = renderStep(sampleMinimalPairs());
    const field = screen.getByRole('spinbutton', { name: 'Pass mark, percent' });
    await user.clear(field);
    await user.type(field, '95');
    expect(screen.getByText(/Pass at 95%/)).toBeInTheDocument();
  });
});

describe('StepResult — memory (MP-B24, MP-B25)', () => {
  const atoms = () => document.querySelectorAll<HTMLElement>('[data-on]');

  it('rates the contrast alone by default: the contrast atom is on, the words are dim', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByText('contrast:kjsj · contrast:consonant')).toBeInTheDocument();
    expect(screen.getByText('kjære · skjære · kjekk · sjekk …')).toBeInTheDocument();
    expect(atoms()).toHaveLength(1);
  });

  it('lights the word atoms for contrast + words, and both go dim for nothing', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('radio', { name: 'Contrast + words' }));
    expect(last().scoring.memory).toBe('contrast+word');
    expect(atoms()).toHaveLength(2);
    expect(screen.getByText(/Writing to the word atoms too/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Nothing' }));
    expect(last().scoring.memory).toBe('none');
    expect(atoms()).toHaveLength(0);
    expect(screen.getByText(/Nothing is written to memory/)).toBeInTheDocument();
  });

  it('says honestly what is not live yet: the contrast card and the exposure (Q1-A)', () => {
    renderStep(sampleMinimalPairs());
    expect(
      screen.getByText(/its own review schedule arrives after plan 63 phase 7/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Exposure is stored with the exercise and not yet written/),
    ).toBeInTheDocument();
  });

  it('toggles the exposure log', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('switch', { name: /Log the word as heard/ }));
    expect(last().scoring.logWordExposure).toBe(false);
    expect(screen.queryByText(/Exposure is stored with the exercise/)).toBeNull();
  });

  it('maps the sittings buttons onto 0 for unlimited, 1, 2, 3 (Q4-A)', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    const group = screen.getByRole('radiogroup', { name: 'Sittings allowed' });
    expect(within(group).getByRole('radio', { name: 'Unlimited' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: '2' }));
    expect(last().scoring.attempts).toBe(2);
    await user.click(within(group).getByRole('radio', { name: 'Unlimited' }));
    expect(last().scoring.attempts).toBe(0);
  });
});

describe('StepResult — what the teacher gets (MP-B26, Q5-A)', () => {
  it('lists the pairs with empty bars and a dash, never made-up numbers', () => {
    renderStep(sampleMinimalPairs());
    const card = screen.getByRole('region', { name: 'What the teacher gets' });
    expect(within(card).getByText('kjære / skjære')).toBeInTheDocument();
    expect(within(card).getAllByText('—')).toHaveLength(4);
    expect(within(within(card).getByRole('list')).queryByText(/\d+\s*%/)).toBeNull();
    expect(within(card).getByText(/appear in the exercise report \(planned\)/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleMinimalPairs());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
