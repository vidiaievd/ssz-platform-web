import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { SAMPLE_FIELD_IDS } from '@/lib/shared-kernel/information-transfer';

import { setExpected, setGrading, type InformationTransferDocument } from './edits';
import { StepAnswers } from './step-answers';
import { blankDocument, Harness, PAGE_RULES, sampleDocument } from './test-support';

function renderStep(initial: InformationTransferDocument) {
  const changes: InformationTransferDocument[] = [];
  const view = render(
    <Harness initial={initial} step={StepAnswers} onChange={(next) => changes.push(next)} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

const [, CLOCK, ROOM, , , NAME] = SAMPLE_FIELD_IDS;
const row = (id: string) => screen.getByTestId(`inf-accrow-${id}`);
const chip = (id: string, text: string) =>
  within(row(id))
    .getAllByRole('listitem')
    .find((li) => li.textContent === text);

describe('StepAnswers — what counts as the same answer (INF-B13…B16)', () => {
  it('draws the three switches with the prototype’s defaults', () => {
    renderStep(sampleDocument());
    expect(screen.getByRole('switch', { name: /Accept spelled-out numerals/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Forgive one typo/ })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: /Case-sensitive/ })).not.toBeChecked();
  });

  it('writes a switch into the grading of the document', async () => {
    const { user, last } = renderStep(sampleDocument());
    await user.click(screen.getByRole('switch', { name: /Forgive one typo/ }));
    expect(last().grading.typos).toBe(true);
    // The kernel's note about it appears under the switches.
    expect(screen.getByText(/Typos are forgiven on names and words/)).toBeInTheDocument();
  });

  it('makes the numerals switch inert in a course without a pack, and says why (Q2-A)', () => {
    const doc = sampleDocument();
    doc.language = 'de';
    renderStep(doc);
    const spelled = screen.getByRole('switch', { name: /Accept spelled-out numerals/ });
    expect(spelled).toBeDisabled();
    expect(spelled).not.toBeChecked();
    expect(screen.getByText(/no language pack/)).toBeInTheDocument();
  });

  it('marks every chip by the real judge: the author’s own green, the core’s grey', () => {
    renderStep(sampleDocument());
    expect(chip(CLOCK, '17:30')).toHaveAttribute('data-v', 'ok');
    expect(chip(CLOCK, 'kl. 17.30')).toHaveAttribute('data-v', 'format');
    expect(chip(CLOCK, 'halv seks')).toHaveAttribute('data-v', 'format');
    expect(chip(NAME, 'Anne Lise Berg')).toHaveAttribute('data-v', 'ok');
    expect(screen.getByText('your key passes your grader')).toBeInTheDocument();
  });

  it('turns the spelled-out chip red when numerals in words are switched off', () => {
    renderStep(setGrading(sampleDocument(), { spelledNumbers: false }));
    expect(chip(CLOCK, 'halv seks')).toHaveAttribute('data-v', 'bad');
    expect(chip(CLOCK, '17:30')).toHaveAttribute('data-v', 'ok');
  });

  it('flags a key the core cannot read — on the card, the row and the head', () => {
    renderStep(setExpected(sampleDocument(), ROOM!, 0, 'to hundre og fire rom'));
    const room = row(ROOM!);
    expect(within(room).getByText('nothing the core can read')).toHaveAttribute('data-v', 'bad');
    expect(within(room).getByText(/cannot be read as a number/)).toBeInTheDocument();
    expect(screen.getByText('your key fails your grader')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Accepted forms, per cell' })).toHaveAttribute(
      'data-bad',
      'true',
    );
  });

  it('runs «try an answer» through the judge, and never writes it to the document', async () => {
    const { user, changes } = renderStep(sampleDocument());
    const input = within(row(CLOCK!)).getByRole('textbox', { name: /Try an answer/ });
    expect(within(row(CLOCK!)).getByText('runs the real validator')).toBeInTheDocument();

    await user.type(input, 'halv seks');
    expect(within(row(CLOCK!)).getByRole('status')).toHaveTextContent('accepted → 17:30');
    await user.clear(input);
    await user.type(input, '17:30');
    expect(within(row(CLOCK!)).getByRole('status')).toHaveTextContent('accepted, as written');
    await user.clear(input);
    await user.type(input, '18:30');
    expect(within(row(CLOCK!)).getByRole('status')).toHaveTextContent('wrong fact');
    await user.clear(input);
    await user.type(input, 'i morgen');
    expect(within(row(CLOCK!)).getByRole('status')).toHaveTextContent('cannot be read as a time');
    expect(changes).toEqual([]);
  });

  it('accepts a near-miss on a name as a typo only when typos are forgiven', async () => {
    const { user } = renderStep(setGrading(sampleDocument(), { typos: true }));
    await user.type(within(row(NAME!)).getByRole('textbox'), 'Anne Lise Bergg');
    expect(within(row(NAME!)).getByRole('status')).toHaveTextContent('accepted as a typo');
  });

  it('offers the 24-hour reading for a clock time that reads two ways', async () => {
    const { user, last } = renderStep(setExpected(sampleDocument(), CLOCK!, 0, 'halv seks'));
    expect(
      within(row(CLOCK!)).getByText(/ambiguous between morning and afternoon/),
    ).toBeInTheDocument();
    await user.click(within(row(CLOCK!)).getByRole('button', { name: /^Use / }));
    expect(last().fields[1]?.expected[0]).toMatch(/^\d\d:\d\d$/);
  });

  it('shows the empty state while no field has an expected answer', () => {
    renderStep(blankDocument());
    expect(screen.getByText('No expected answers yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleDocument());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
