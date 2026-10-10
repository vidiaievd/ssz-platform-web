import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import type { MinimalPairsDocument } from './edits';
import { StepFeedback } from './step-feedback';
import { Harness, PAGE_RULES, sampleMinimalPairs } from './test-support';

function renderStep(initial: MinimalPairsDocument) {
  const changes: MinimalPairsDocument[] = [];
  const view = render(
    <Harness initial={initial} onChange={(next) => changes.push(next)} step={StepFeedback} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

describe('StepFeedback (MP-B21, MP-B22)', () => {
  it('lists the four switches with the prototype’s help, in the document’s state', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByRole('switch', { name: /Verdict straight away/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /A\/B comparison on a wrong answer/ })).toBeChecked();
    expect(
      screen.getByRole('switch', { name: /Second chance before it counts/ }),
    ).not.toBeChecked();
    expect(screen.getByRole('switch', { name: /Show IPA in the feedback/ })).not.toBeChecked();
    expect(
      screen.getByText(/The first answer is still what rates the contrast/),
    ).toBeInTheDocument();
  });

  it('writes each switch through the kernel', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('switch', { name: /Second chance/ }));
    expect(last().feedback.secondChance).toBe(true);
    await user.click(screen.getByRole('switch', { name: /Show IPA/ }));
    expect(last().feedback.showIpa).toBe(true);
    await user.click(screen.getByRole('switch', { name: /A\/B comparison/ }));
    expect(last().feedback.abCompare).toBe(false);
    await user.click(screen.getByRole('switch', { name: /Verdict straight away/ }));
    expect(last().feedback.immediate).toBe(false);
  });

  it('sets what the buttons show: spelling and meaning', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('radio', { name: 'Only after the answer' }));
    expect(last().feedback.showSpelling).toBe('afterAnswer');
    await user.click(screen.getByRole('radio', { name: 'Never' }));
    expect(last().feedback.showGloss).toBe('never');
  });

  it('carries the kernel’s notes, drawn where the setting is', async () => {
    const { user } = renderStep(sampleMinimalPairs());
    expect(screen.queryByText(/A second chance is recorded/)).toBeNull();
    await user.click(screen.getByRole('switch', { name: /Second chance/ }));
    expect(
      screen.getByText(/A second chance is recorded as a separate probe result/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Verdict straight away/ }));
    expect(screen.getByText(/No immediate feedback/)).toBeInTheDocument();
  });

  it('names the pairing most teachers land on', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByText(/the pairing most teachers land on/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleMinimalPairs());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
