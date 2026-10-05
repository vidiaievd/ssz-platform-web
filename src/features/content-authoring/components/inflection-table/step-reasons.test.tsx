import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  addManualRow,
  emptyContent,
  sampleContent,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

import { StepReasons } from './step-reasons';

function Harness({
  initial,
  spy,
  goTo,
}: {
  initial: InflectionTableContent;
  spy: (ex: InflectionTableContent) => void;
  goTo: (step: number) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepReasons
      exercise={ex}
      onGoToStep={goTo}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: InflectionTableContent) {
  const spy = vi.fn();
  const goTo = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} goTo={goTo} />
    </NextIntlClientProvider>,
  );
  return {
    ...view,
    goTo,
    user: userEvent.setup(),
    last: () => spy.mock.calls.at(-1)?.[0] as InflectionTableContent,
  };
}

const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };

/** A one-row table whose asked cells have keys and no reasons. */
function unreasoned(): InflectionTableContent {
  const base = sampleContent();
  const row = base.rows[0]!;
  const cells = Object.fromEntries(
    Object.entries(row.cells).map(([id, c]) => [id, { ...c, why: '', accept: [] }]),
  );
  return { ...base, rows: [{ ...row, cells }] };
}

describe('StepReasons', () => {
  it('says nothing is asked yet, and goes back to the grid', async () => {
    const { user, goTo } = draw(emptyContent('nb'));
    expect(screen.getByText('Nothing is asked yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the grid' }));
    expect(goTo).toHaveBeenCalledWith(2);
  });

  it('draws one card per row that asks something, and none for a fully given row', () => {
    const base = sampleContent();
    const given = Object.fromEntries(
      Object.entries(base.rows[1]!.cells).map(([id, c]) => [
        id,
        { ...c, mode: 'prefill' as const },
      ]),
    );
    draw({
      ...base,
      rows: [base.rows[0]!, { ...base.rows[1]!, cells: given }],
    });
    expect(screen.getByRole('heading', { name: 'en jobb' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ei bok' })).not.toBeInTheDocument();
    expect(screen.getByText('3 asked')).toBeInTheDocument();
  });

  it('shows each asked cell with its key, its short label and its address', () => {
    draw(unreasoned());
    expect(screen.getByText('r1:defSg')).toBeInTheDocument();
    expect(screen.getByText('best. ent.')).toBeInTheDocument();
    expect(screen.getByText('jobben')).toBeInTheDocument();
  });

  it('marks a cell with a key and no reason red and invalid, and clears it when written (IT-B8)', async () => {
    const { user, last } = draw(unreasoned());
    const field = screen.getByRole('textbox', { name: 'Reason — en jobb · Bestemt entall' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await user.type(field, 'Hankjønn.');
    expect(last().rows[0]?.cells['defSg']?.why).toBe('Hankjønn.');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('takes its placeholder from the pack, not from the code', () => {
    draw(unreasoned());
    expect(
      screen.getAllByPlaceholderText('Hunkjønn i bokmål: ei bok → boka.').length,
    ).toBeGreaterThan(0);
  });

  it('says «no key» for an asked cell with none', () => {
    draw(addManualRow(emptyContent('nb')));
    expect(screen.getAllByText('no key').length).toBeGreaterThan(0);
  });

  it('adds a variant on Enter, refuses the key itself, and removes one', async () => {
    const { user, last } = draw(unreasoned());
    const box = within(
      screen.getByRole('textbox', { name: 'Reason — en jobb · Bestemt entall' }).parentElement!,
    ).getByPlaceholderText('+ variant');
    await user.type(box, 'jobbet{Enter}');
    expect(last().rows[0]?.cells['defSg']?.accept).toEqual(['jobbet']);
    await user.type(box, 'jobben{Enter}');
    expect(last().rows[0]?.cells['defSg']?.accept).toEqual(['jobbet']);
    await user.click(screen.getByRole('button', { name: 'Remove “jobbet”' }));
    expect(last().rows[0]?.cells['defSg']?.accept).toEqual([]);
  });

  it('warns with the pack’s own example pair', () => {
    draw(unreasoned());
    expect(screen.getByText(/is a blocker, not a warning/)).toHaveTextContent('bøker');
    expect(screen.getByText(/is a blocker, not a warning/)).toHaveTextContent('bøkene');
  });

  it('has no axe violations, empty or with cards', async () => {
    const empty = draw(emptyContent('nb'));
    expect((await axe.run(empty.container, PAGE_RULES)).violations).toEqual([]);
    empty.unmount();
    const full = draw(unreasoned());
    expect((await axe.run(full.container, PAGE_RULES)).violations).toEqual([]);
  });
});
