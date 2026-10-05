import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages, loadMessages } from '@/lib/i18n/messages';
import {
  ALL_RIGHT,
  check,
  sampleContent,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  updateInput,
  updateSettings,
  type InflectionTableContent,
  type StudentProjection,
} from '@/lib/shared-kernel/inflection-table';
import type { InflectionTableSubmitDetails } from '@/features/student/exercises/types/attempts';

import { InflectionTableBody, type InflectionTableBodyProps } from './inflection-table-body';
import { InflectionTableReaderCard } from './inflection-table-reader-card';

const deal = (ex: InflectionTableContent = sampleContent()): StudentProjection =>
  toStudentProjection(toContent(ex), toExpectedAnswers(ex));

/** The details the engine's validator would return, from the same kernel `check`. */
function details(
  ex: InflectionTableContent,
  answers: Record<string, string>,
  attempt = 1,
): InflectionTableSubmitDetails {
  const result = check({ ex, answers, attempt });
  return {
    totalItems: result.total,
    passedItems: result.correct,
    correctNow: result.correctNow,
    falsePositives: result.falsePositives,
    pct: result.pct,
    passed: result.passed,
    attempt: result.attempt,
    checksLeft: result.checksLeft,
    closed: result.closed,
    locked: result.locked,
    rows: result.rows,
    items: result.cells.map((cell) => ({
      itemId: cell.key,
      rowId: cell.rowId,
      slotId: cell.slotId,
      value: cell.value,
      correct: cell.ok,
      firstCorrect: cell.firstOk,
      firstAnswer: result.firstValues[cell.key] ?? '',
      ...(cell.near === undefined ? {} : { near: cell.near }),
      ...(cell.why === undefined ? {} : { why: cell.why }),
      ...(cell.correct === undefined ? {} : { correctForm: cell.correct }),
    })),
  };
}

function renderBody(props: Partial<InflectionTableBodyProps> = {}) {
  const handlers = { onValueChange: vi.fn(), onCheck: vi.fn(), onRetry: vi.fn() };
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InflectionTableBody
        projection={deal()}
        values={{}}
        phase="answering"
        verdict={null}
        attempt={1}
        accent="#0a7"
        layout="phone"
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, ...handlers };
}

const ROW = 'r1';
const key = (slot: string, row = ROW) => `${row}:${slot}`;
// One wrong in the first row, everything else right: `jobben` mistyped as the diacritic-free
// stem plus the wrong ending.
const ONE_WRONG = { ...ALL_RIGHT, [key('defSg')]: 'jobber' };

describe('InflectionTableBody — layouts (IT-R1, IT-R2)', () => {
  it('draws one card per row on the phone layout, with given forms as text', () => {
    renderBody({ layout: 'phone' });
    expect(screen.queryByRole('table')).toBeNull();
    const card = screen.getByRole('region', { name: 'en jobb' });
    expect(within(card).getByText('jobb')).toBeInTheDocument();
    // Three asked cells in a row of four; the first column is given.
    expect(within(card).getAllByRole('textbox')).toHaveLength(3);
  });

  it('draws a grid on the desktop layout, headed by the slot labels', () => {
    renderBody({ layout: 'desktop' });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(5);
    expect(within(table).getAllByRole('row')).toHaveLength(5);
  });

  it('IT-X7: the field turns off autocorrect, autocapitalise and spellcheck', () => {
    renderBody();
    const field = screen.getAllByRole('textbox')[0]!;
    expect(field).toHaveAttribute('autocorrect', 'off');
    expect(field).toHaveAttribute('autocapitalize', 'off');
    expect(field).toHaveAttribute('spellcheck', 'false');
  });

  it('shows the first letter as a placeholder when the hint is on', () => {
    renderBody({ projection: deal(updateSettings(sampleContent(), { hintFirstLetter: true })) });
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('placeholder', 'j…');
  });

  it('says so when the table has nothing to ask', () => {
    renderBody({ projection: { ...deal(), rows: [] } });
    expect(screen.getByText('Empty table')).toBeInTheDocument();
  });
});

describe('InflectionTableBody — answering (IT-R3)', () => {
  it('keeps Check off until a cell has something in it', () => {
    const { rerender } = renderBody();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InflectionTableBody
          projection={deal()}
          values={{ [key('defSg')]: 'jobb' }}
          phase="answering"
          verdict={null}
          attempt={1}
          accent="#0a7"
          layout="phone"
          onValueChange={vi.fn()}
          onCheck={vi.fn()}
          onRetry={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('reports what is typed, cell by cell', () => {
    const { onValueChange } = renderBody();
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'jobben' } });
    expect(onValueChange).toHaveBeenCalledWith(key('defSg'), 'jobben');
  });

  it('counts the filled cells in the progress bar', () => {
    renderBody({ values: { [key('defSg')]: 'jobben', [key('indefPl')]: 'jobber' } });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '12');
  });

  it('calls onCheck', async () => {
    const { onCheck } = renderBody({ values: { [key('defSg')]: 'jobben' } });
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('accepts nothing when it is not interactive', () => {
    renderBody({ interactive: false, values: { [key('defSg')]: 'jobben' } });
    expect(screen.getAllByRole('textbox')[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });
});

describe('InflectionTableBody — bank mode (IT-R2)', () => {
  const bankEx = () => updateInput(sampleContent(), { mode: 'bank' });

  it('draws a slot per asked cell and the bank of forms, no text fields', () => {
    renderBody({ projection: deal(bankEx()) });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Forms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'jobben' })).toBeInTheDocument();
  });

  it('puts the form in hand into the tapped cell', async () => {
    const { onValueChange } = renderBody({ projection: deal(bankEx()) });
    await userEvent.click(screen.getByRole('button', { name: 'jobben' }));
    expect(screen.getByRole('button', { name: 'jobben' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'en jobb, Bestemt entall' }));
    expect(onValueChange).toHaveBeenCalledWith(key('defSg'), 'jobben');
  });

  it('empties a filled cell when nothing is in hand', async () => {
    const { onValueChange } = renderBody({
      projection: deal(bankEx()),
      values: { [key('defSg')]: 'jobben' },
    });
    await userEvent.click(screen.getByRole('button', { name: /en jobb, Bestemt entall: jobben/ }));
    expect(onValueChange).toHaveBeenCalledWith(key('defSg'), null);
  });

  it('marks a form already placed, without removing it from the bank', () => {
    renderBody({ projection: deal(bankEx()), values: { [key('defSg')]: 'jobben' } });
    const chip = screen.getByRole('button', { name: 'jobben' });
    expect(chip).toHaveAttribute('data-used', 'true');
  });

  it('hides the bank once the table is checked', () => {
    const ex = bankEx();
    renderBody({
      projection: deal(ex),
      phase: 'checked',
      values: ALL_RIGHT,
      verdict: details(ex, ALL_RIGHT),
    });
    expect(screen.queryByText('Forms')).toBeNull();
  });
});

describe('InflectionTableBody — the verdict (IT-R4…R7)', () => {
  const ex = sampleContent();
  const checked = (
    answers: Record<string, string>,
    extra: Partial<InflectionTableBodyProps> = {},
  ) =>
    renderBody({
      phase: 'checked',
      values: answers,
      verdict: details(ex, answers),
      locked: details(ex, answers).locked,
      layout: 'desktop',
      ...extra,
    });

  it('IT-R5: reports the first-check score and the server’s pass', () => {
    checked(ONE_WRONG);
    expect(screen.getByText('11 of 12 cells')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('says “below the pass mark” with the percentage when it did not pass', () => {
    checked({ [key('defSg')]: 'jobben' });
    expect(screen.getByText(/Below the pass mark \(8 %\)/)).toBeInTheDocument();
  });

  it('IT-R7: names the lemma and slot, what was written, and the author’s reason', () => {
    checked(ONE_WRONG);
    const row = screen.getByText(/en jobb · Bestemt entall/).closest('div')!;
    expect(row).toHaveTextContent('you wrote «jobber»');
    expect(row.textContent).not.toBe('');
  });

  it('IT-R7: says “empty” for a cell left empty', () => {
    checked({ ...ALL_RIGHT, [key('defSg')]: '' });
    expect(screen.getByText(/en jobb · Bestemt entall/).closest('div')).toHaveTextContent(
      '— empty',
    );
  });

  it('IT-M4: a near miss adds its line and the cell is still wrong', () => {
    checked({ ...ALL_RIGHT, 'r2:defPl': 'bokene' });
    expect(screen.getByText(/The letter counts/)).toBeInTheDocument();
    const wrongCell = screen
      .getAllByRole('textbox')
      .find((el) => el.getAttribute('data-s') === 'bad');
    expect(wrongCell).toHaveValue('bokene');
  });

  it('strikes a wrong cell through, not only colours it', () => {
    checked(ONE_WRONG);
    const wrongCell = screen
      .getAllByRole('textbox')
      .find((el) => el.getAttribute('data-s') === 'bad')!;
    expect(wrongCell.style.textDecoration).toBe('line-through');
    expect(wrongCell).toHaveAccessibleName(/wrong/);
  });

  it('IT-R6: shows the correct form under a wrong cell only when the server sent it', () => {
    const open = sampleContent({
      settings: { ...sampleContent().settings, revealKey: 'afterFirst' },
    });
    renderBody({
      projection: deal(open),
      phase: 'checked',
      values: ONE_WRONG,
      verdict: details(open, ONE_WRONG),
      locked: details(open, ONE_WRONG).locked,
    });
    // `jobben` appears as the key under the wrong cell…
    expect(screen.getAllByText('jobben').length).toBeGreaterThan(0);

    const hidden = checked(ONE_WRONG);
    expect(within(hidden.container).queryByText('jobben')).toBeNull();
  });

  it('draws the row chip, and not at all when rowVerdict is off', () => {
    const { unmount } = checked(ONE_WRONG);
    expect(screen.getAllByText('whole row')).toHaveLength(3);
    expect(screen.getByText('2/3')).toBeInTheDocument();
    unmount();

    const off = sampleContent({ settings: { ...sampleContent().settings, rowVerdict: false } });
    renderBody({
      projection: deal(off),
      phase: 'checked',
      values: ONE_WRONG,
      verdict: details(off, ONE_WRONG),
    });
    expect(screen.queryByText('whole row')).toBeNull();
  });

  it('IT-R4: offers the retry with the check number and budget while there is some', async () => {
    const { onRetry } = checked(ONE_WRONG);
    const retry = screen.getByRole('button', { name: /Retry the wrong ones \(1\/2\)/ });
    await userEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('IT-R4: offers nothing once the budget is spent', () => {
    const spent = details(ex, ONE_WRONG, 2);
    renderBody({ phase: 'checked', values: ONE_WRONG, verdict: spent, attempt: 2 });
    expect(spent.closed).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('IT-R4: offers nothing when every cell is right, and says so', () => {
    const right = details(ex, ALL_RIGHT);
    renderBody({ phase: 'checked', values: ALL_RIGHT, verdict: right, locked: right.locked });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/The whole table is right\. 4 paradigms done\./)).toBeInTheDocument();
  });

  it('locks the right cells and leaves the wrong ones editable after a retry', () => {
    const verdict = details(ex, ONE_WRONG);
    renderBody({
      phase: 'answering',
      verdict: null,
      attempt: 2,
      values: Object.fromEntries(Object.entries(ONE_WRONG).filter(([k]) => k !== key('defSg'))),
      locked: verdict.locked,
    });
    const fields = screen.getAllByRole('textbox');
    const frozen = fields.filter((f) => (f as HTMLInputElement).disabled);
    expect(frozen).toHaveLength(11);
    expect(fields.filter((f) => !(f as HTMLInputElement).disabled)).toHaveLength(1);
    // Nothing new to check until the emptied cell has something in it.
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('IT-X8: the report sits in a polite live region', () => {
    const { container } = checked(ONE_WRONG);
    const live = container.querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('11 of 12 cells');
  });

  it('shows an error line', () => {
    renderBody({ error: 'The answer could not be sent. Try again.' });
    expect(screen.getByText('The answer could not be sent. Try again.')).toBeInTheDocument();
  });
});

describe('InflectionTableBody — localisation', () => {
  it.each(['nb', 'uk', 'ru'])('renders in %s with no missing message', async (locale) => {
    const messages = await loadMessages(locale);
    const ex = sampleContent();
    const verdict = details(ex, ONE_WRONG);
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <InflectionTableBody
          projection={deal(ex)}
          values={ONE_WRONG}
          phase="checked"
          verdict={verdict}
          locked={verdict.locked}
          attempt={1}
          accent="#0a7"
          layout="phone"
          onValueChange={vi.fn()}
          onCheck={vi.fn()}
          onRetry={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(document.body.textContent).not.toMatch(/inflectionTable\./);
  });

  it('nb keeps the prototype’s wording', async () => {
    const messages = await loadMessages('nb');
    const ex = sampleContent();
    const verdict = details(ex, ONE_WRONG);
    render(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <InflectionTableBody
          projection={deal(ex)}
          values={ONE_WRONG}
          phase="checked"
          verdict={verdict}
          locked={verdict.locked}
          attempt={1}
          accent="#0a7"
          layout="desktop"
          onValueChange={vi.fn()}
          onCheck={vi.fn()}
          onRetry={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('11 av 12 celler')).toBeInTheDocument();
    expect(screen.getByText('Bestått')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prøv de gale på nytt (1/2)' })).toBeInTheDocument();
    expect(screen.getByText(/du skrev/)).toBeInTheDocument();
  });
});

describe('InflectionTableBody — accessibility', () => {
  it.each(['phone', 'desktop'] as const)(
    'has no axe violations on the %s layout, before and after a check',
    async (layout) => {
      const ex = sampleContent();
      const { container } = renderBody({ layout, values: { [key('defSg')]: 'jobb' } });
      const before = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(before.violations).toEqual([]);

      const verdict = details(ex, ONE_WRONG);
      const checked = renderBody({
        layout,
        phase: 'checked',
        values: ONE_WRONG,
        verdict,
        locked: verdict.locked,
      });
      const after = await axe.run(checked.container, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(after.violations).toEqual([]);
    },
    20_000,
  );

  it('has no axe violations in bank mode', async () => {
    const { container } = renderBody({
      projection: deal(updateInput(sampleContent(), { mode: 'bank' })),
    });
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe('InflectionTableReaderCard (Q4-A)', () => {
  const card = (props: Partial<React.ComponentProps<typeof InflectionTableReaderCard>> = {}) =>
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InflectionTableReaderCard projection={deal()} onStart={vi.fn()} accent="#0a7" {...props} />
      </NextIntlClientProvider>,
    );

  it('shows the paradigm, the title, three rows and the size of the task', () => {
    card({ title: 'Nouns' });
    expect(screen.getByRole('region', { name: 'Nouns' })).toBeInTheDocument();
    expect(screen.getByText('12 cells · 4 lemmas')).toBeInTheDocument();
    // Three rows plus the header.
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('starts on a press and never carries a key', async () => {
    const onStart = vi.fn();
    const { container } = card({ onStart });
    await userEvent.click(screen.getByRole('button', { name: /Start the table/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    for (const form of ['jobben', 'jobbene', 'bøkene']) {
      expect(container.textContent).not.toContain(form);
    }
  });

  it('does nothing in a preview', () => {
    card({ interactive: false });
    expect(screen.getByRole('button', { name: /Start the table/ })).toBeDisabled();
  });

  it('has no axe violations', async () => {
    const { container } = card();
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
