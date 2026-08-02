import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import {
  RationaleMatrix,
  buildRationaleRows,
  type Rationale,
  type RationaleOption,
} from './rationale-matrix';

const messages = {
  ExerciseRunner: {
    fill: {
      rationaleTitle: 'Why this answer',
      optionHeader: 'Option',
      verdictHeader: 'Fits?',
      noteHeader: 'Why',
      verdictCorrect: 'Correct',
      verdictAcceptable: 'Possible, but not here',
      verdictWrong: 'Wrong',
      yourAnswer: 'Your answer',
      chosenWrongNote: 'Doesn’t fit in this sentence.',
    },
  },
};

/* Mirrors the real b1-g1-fib-01 seed: a seven-word bank, three analysed rows. */
const OPTIONS: RationaleOption[] = [
  { text: 'at', verdict: 'correct', note: 'Statement → at.' },
  { text: 'om', verdict: 'wrong', note: 'Only for yes/no questions.' },
  { text: 'hvorfor', verdict: 'acceptable', note: 'Grammatical, but not in this context.' },
];

const RATIONALE: Rationale = {
  explanation: 'A statement is introduced by «at».',
  options: OPTIONS,
};

function renderMatrix(props: Partial<Parameters<typeof RationaleMatrix>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RationaleMatrix rationale={RATIONALE} {...props} />
    </NextIntlClientProvider>,
  );
}

/** Option-column text of every body row, in render order. */
function rowOrder(): string[] {
  const body = screen.getAllByRole('rowgroup')[1]!;
  return within(body)
    .getAllByRole('row')
    .map((r) => within(r).getAllByRole('cell')[0]!.textContent ?? '');
}

describe('buildRationaleRows', () => {
  it('keeps authored rows untouched when the pick is already analysed', () => {
    const rows = buildRationaleRows(OPTIONS, 'om', false);
    expect(rows.map((r) => r.text)).toEqual(['at', 'om', 'hvorfor']);
    expect(rows.every((r) => !r.synthesized)).toBe(true);
    expect(rows.filter((r) => r.mine).map((r) => r.text)).toEqual(['om']);
  });

  it('adds a row for a pick the author never analysed', () => {
    const rows = buildRationaleRows(OPTIONS, 'hvordan', false);
    const mine = rows.find((r) => r.mine);
    expect(mine).toMatchObject({ text: 'hvordan', verdict: 'wrong', synthesized: true });
  });

  it('never synthesizes a second correct row for a correct pick', () => {
    const rows = buildRationaleRows(OPTIONS, 'på', true);
    expect(rows.map((r) => r.text)).toEqual(['at', 'om', 'hvorfor']);
    expect(rows.filter((r) => r.verdict === 'correct')).toHaveLength(1);
  });

  it('orders correct first, the learner’s pick second, the rest after', () => {
    expect(buildRationaleRows(OPTIONS, 'hvordan', false).map((r) => r.text)).toEqual([
      'at',
      'hvordan',
      'om',
      'hvorfor',
    ]);
    expect(buildRationaleRows(OPTIONS, 'hvorfor', false).map((r) => r.text)).toEqual([
      'at',
      'hvorfor',
      'om',
    ]);
  });

  it('matches the pick case-insensitively and ignores surrounding spaces', () => {
    const rows = buildRationaleRows(OPTIONS, '  OM ', false);
    expect(rows.filter((r) => r.mine).map((r) => r.text)).toEqual(['om']);
    expect(rows).toHaveLength(3);
  });

  it('adds nothing when the blank was left empty', () => {
    const rows = buildRationaleRows(OPTIONS, '', false);
    expect(rows).toHaveLength(3);
    expect(rows.some((r) => r.mine)).toBe(false);
  });
});

describe('RationaleMatrix', () => {
  it('shows the learner’s unanalysed pick as its own row with a fallback note', () => {
    renderMatrix({ chosen: 'hvordan', chosenCorrect: false });

    const row = screen.getByRole('cell', { name: /hvordan/ }).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('Wrong')).toBeInTheDocument();
    expect(
      within(row!).getByText('Doesn’t fit in this sentence.'),
    ).toBeInTheDocument();
  });

  it('labels the row the learner picked and lifts it below the correct one', () => {
    renderMatrix({ chosen: 'hvordan', chosenCorrect: false });

    expect(screen.getByText('Your answer')).toBeInTheDocument();
    expect(rowOrder().map((t) => t.replace('Your answer', ''))).toEqual([
      'at',
      'hvordan',
      'om',
      'hvorfor',
    ]);
  });

  it('keeps the authored note when the pick was analysed', () => {
    renderMatrix({ chosen: 'om', chosenCorrect: false });

    const row = screen.getByRole('cell', { name: /om/ }).closest('tr');
    expect(within(row!).getByText('Only for yes/no questions.')).toBeInTheDocument();
    expect(screen.queryByText('Doesn’t fit in this sentence.')).toBeNull();
  });

  it('renders the authored rows unchanged when nothing was picked', () => {
    renderMatrix({ chosen: '' });
    expect(rowOrder()).toEqual(['at', 'om', 'hvorfor']);
    expect(screen.queryByText('Your answer')).toBeNull();
  });

  it('never grows a table out of an options-less rationale', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RationaleMatrix rationale={{ explanation: 'Just the rule.' }} chosen="hvordan" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Just the rule.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
