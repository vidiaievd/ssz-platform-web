import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import type { InformationTransferDocument } from './edits';
import { StepResult } from './step-result';
import { Harness, PAGE_RULES, sampleDocument } from './test-support';

function renderStep(initial: InformationTransferDocument) {
  const changes: InformationTransferDocument[] = [];
  const view = render(
    <Harness initial={initial} step={StepResult} onChange={(next) => changes.push(next)} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

const atom = (name: RegExp) => screen.getByText(name).closest('[data-on], div')!;

describe('StepResult — result and memory (INF-B22…B26)', () => {
  it('shows the pass mark as cells: ceil(pass · ready)', () => {
    renderStep(sampleDocument());
    expect(screen.getByText('5 of 6 cells')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Pass mark/ })).toHaveValue(75);
  });

  it('clamps the typed pass mark and warns above 90', async () => {
    const { user, last } = renderStep(sampleDocument());
    const field = screen.getByRole('spinbutton', { name: /Pass mark/ });
    await user.clear(field);
    await user.type(field, '140');
    expect(last().scoring.passPct).toBe(100);
    expect(screen.getByText(/one mis-heard digit fails the exercise/)).toBeInTheDocument();
  });

  it('writes «every required cell» into the grading and notes it', async () => {
    const { user, last } = renderStep(sampleDocument());
    await user.click(screen.getByRole('switch', { name: /Every required cell must be right/ }));
    expect(last().grading.requiredAll).toBe(true);
    expect(screen.getByText(/on top of the percentage\. Use it when/)).toBeInTheDocument();
  });

  it('names the skill by the source and dims it under «Nothing»', async () => {
    const { user, last } = renderStep(sampleDocument('audio'));
    expect(atom(/^skill:selective_listening$/)).toHaveAttribute('data-on', 'true');
    expect(atom(/^words · per lexical cell$/)).not.toHaveAttribute('data-on');
    await user.click(screen.getByRole('radio', { name: 'Skill + words' }));
    expect(last().scoring.memory).toBe('skill+words');
    expect(atom(/^words · per lexical cell$/)).toHaveAttribute('data-on', 'true');
    await user.click(screen.getByRole('radio', { name: 'Nothing' }));
    expect(atom(/^skill:selective_listening$/)).not.toHaveAttribute('data-on');
    expect(screen.getByText(/Nothing written to memory/)).toBeInTheDocument();
  });

  it('reads a text source as selective reading', () => {
    renderStep(sampleDocument('text'));
    expect(screen.getByText('skill:selective_reading')).toBeInTheDocument();
  });

  it('says what is not live yet instead of promising it', async () => {
    const { user, last } = renderStep(sampleDocument());
    expect(
      screen.getByText(/its own review schedule arrives after plan 63 phase 7/),
    ).toBeInTheDocument();
    expect(screen.getByText(/not yet written to the word/)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Log words as met/ }));
    expect(last().scoring.logWordExposure).toBe(false);
    expect(screen.queryByText(/not yet written to the word/)).toBeNull();
  });

  it('lists the cells for the teacher without made-up numbers', () => {
    renderStep(sampleDocument());
    const card = screen.getByRole('region', { name: 'What the teacher gets' });
    expect(card).toHaveTextContent('Klokkeslett');
    expect(card).not.toHaveTextContent(/\d+%/);
    expect(card).toHaveTextContent(/appear in the exercise report \(planned\)/);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleDocument());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
