import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { RA_MAX_CRITERIA } from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';
import { addCriterion, removeCriterion } from './edits';
import { StepRubric } from './step-rubric';
import { Harness, PAGE_RULES, sampleReadAloud } from './test-support';

function renderStep(initial: ReadAloudDocument, onChange?: (next: ReadAloudDocument) => void) {
  const view = render(<Harness initial={initial} step={StepRubric} onChange={onChange} />);
  return { user: userEvent.setup(), ...view };
}

const card = (name: string) => screen.getByRole('region', { name });

describe('StepRubric — the meter (RA-B7)', () => {
  it('shows the pass mark against the maximum of Σ 3 × weight', () => {
    renderStep(sampleReadAloud());
    expect(screen.getByText('points to pass').previousElementSibling).toHaveTextContent('9 / 15');
    expect(screen.getByRole('spinbutton', { name: 'Points needed to pass' })).toHaveValue(9);
    expect(screen.getByRole('spinbutton', { name: 'Points needed to pass' })).toHaveAttribute(
      'max',
      '15',
    );
  });

  it('moves the meter with the pass mark and the maximum with the weights', async () => {
    const { user } = renderStep(sampleReadAloud());
    const pass = screen.getByRole('spinbutton', { name: 'Points needed to pass' });
    await user.clear(pass);
    await user.type(pass, '12');
    expect(screen.getByText('points to pass').previousElementSibling).toHaveTextContent('12 / 15');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '80');
    await user.click(within(card('Flyt')).getByRole('radio', { name: '×2' }));
    expect(screen.getByText('points to pass').previousElementSibling).toHaveTextContent('12 / 18');
  });
});

describe('StepRubric — a criterion (RA-B7)', () => {
  it('opens the first criterion with its four levels, top to bottom', () => {
    renderStep(sampleReadAloud());
    const first = card('Uttale');
    const levels = within(first).getAllByLabelText(/^Level \d of/);
    expect(levels.map((el) => el.getAttribute('aria-label'))).toEqual([
      'Level 3 of Uttale',
      'Level 2 of Uttale',
      'Level 1 of Uttale',
      'Level 0 of Uttale',
    ]);
  });

  it('folds the others to the two ends of the scale', () => {
    renderStep(sampleReadAloud());
    expect(within(card('Flyt')).queryByLabelText(/^Level \d of/)).not.toBeInTheDocument();
    expect(
      within(card('Flyt')).getByText(
        /3 — Naturlig tempo og pauser på riktig sted\. · 0 — Stopper opp/,
      ),
    ).toBeInTheDocument();
  });

  it('opens a folded criterion and writes a level', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(within(card('Flyt')).getByRole('button', { name: 'Show the levels of Flyt' }));
    const level = within(card('Flyt')).getByLabelText('Level 1 of Flyt');
    await user.type(level, ' Ekstra');
    expect(level).toHaveValue('Mange pauser midt i setninger. Ekstra');
  });

  it('switches the weight between ×1 and ×2', async () => {
    const { user } = renderStep(sampleReadAloud());
    const flow = card('Flyt');
    expect(within(flow).getByRole('radio', { name: '×1' })).toBeChecked();
    await user.click(within(flow).getByRole('radio', { name: '×2' }));
    expect(within(flow).getByRole('radio', { name: '×2' })).toBeChecked();
  });

  it('toggles whether the student sees the criterion', async () => {
    const { user } = renderStep(sampleReadAloud());
    const flow = card('Flyt');
    await user.click(within(flow).getByRole('button', { name: 'shown to the student' }));
    expect(within(flow).getByRole('button', { name: 'teacher only' })).toBeInTheDocument();
  });

  it('marks a criterion without a name', async () => {
    const base = sampleReadAloud();
    const { user } = renderStep(addCriterion(base));
    expect(screen.getByRole('region', { name: 'Criterion 4' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name of criterion 4')).toBeInvalid();
    await user.type(screen.getByLabelText('Name of criterion 4'), 'Ordforråd');
    expect(screen.getByRole('region', { name: 'Ordforråd' })).toBeInTheDocument();
  });
});

describe('StepRubric — two to five criteria (RA-B8)', () => {
  it('stops adding at five', () => {
    let doc = sampleReadAloud();
    while (doc.rubric.length < RA_MAX_CRITERIA) doc = addCriterion(doc);
    renderStep(doc);
    expect(screen.getByRole('button', { name: 'Add criterion' })).toBeDisabled();
  });

  it('keeps two: the bin is disabled at the floor', () => {
    let doc = sampleReadAloud();
    doc = removeCriterion(doc, doc.rubric[0]!.id);
    renderStep(doc);
    for (const bin of screen.getAllByRole('button', { name: /^Delete criterion/ })) {
      expect(bin).toBeDisabled();
    }
  });

  it('deletes a criterion above the floor', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(within(card('Flyt')).getByRole('button', { name: 'Delete criterion Flyt' }));
    expect(screen.queryByRole('region', { name: 'Flyt' })).not.toBeInTheDocument();
  });
});

describe('StepRubric — what the student sees (RA-B9)', () => {
  it('sets when the rubric and the model reading are shown', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (next) => seen.push(next));
    await user.click(screen.getByRole('radio', { name: 'Always' }));
    expect(seen.at(-1)?.settings.showRubric).toBe('always');
    const model = screen.getByRole('radiogroup', { name: 'Model reading shown after grading' });
    await user.click(within(model).getByRole('radio', { name: 'Never' }));
    expect(seen.at(-1)?.settings.showModel).toBe('never');
  });

  it('offers the model reading only as «after grading» or «never»', () => {
    renderStep(sampleReadAloud());
    const model = screen.getByRole('radiogroup', { name: 'Model reading shown after grading' });
    expect(within(model).getAllByRole('radio')).toHaveLength(2);
  });
});

describe('StepRubric — a11y', () => {
  it('has no axe violations', async () => {
    const { container } = renderStep(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
