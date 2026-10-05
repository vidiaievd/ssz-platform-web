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

import { StepParadigm } from './step-paradigm';

function Harness({
  initial,
  spy,
}: {
  initial: InflectionTableContent;
  spy: (ex: InflectionTableContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepParadigm
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: InflectionTableContent) {
  const spy = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} />
    </NextIntlClientProvider>,
  );
  return { ...view, spy, last: () => spy.mock.calls.at(-1)?.[0] as InflectionTableContent };
}

const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };

describe('StepParadigm — the pack (IT-B2)', () => {
  it('shows the pack the course language selects, locked, with its id and version', () => {
    draw(emptyContent('nb'));
    expect(screen.getByText('nb-core · v2.4')).toBeInTheDocument();
    expect(screen.getByText('Norsk bokmål · kjernepakke')).toBeInTheDocument();
    expect(screen.getByText('course language · nb')).toBeInTheDocument();
  });

  it('offers the pack’s paradigms with their slot counts and short labels', () => {
    draw(emptyContent('nb'));
    const group = screen.getByRole('group', { name: 'Part of speech' });
    const noun = within(group).getByRole('button', { name: /Substantiv/ });
    expect(noun).toHaveAttribute('aria-pressed', 'true');
    expect(within(noun).getByText('4 slots')).toBeInTheDocument();
    expect(
      within(noun).getByText('ub. ent. · best. ent. · ub. fl. · best. fl.'),
    ).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /Verb/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('has no control that renames, reorders or adds a column', () => {
    draw(emptyContent('nb'));
    // Only the paradigm buttons, one switch per slot and the instruction field.
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('says there is no pack, and builds no columns, for a language without one (Q5)', () => {
    draw(emptyContent('xx'));
    expect(screen.getByText('No paradigm pack for this language')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Part of speech' })).not.toBeInTheDocument();
  });
});

describe('StepParadigm — slots (IT-B3)', () => {
  it('lists every slot of the paradigm with its atom, all on in a fresh draft', () => {
    draw(emptyContent('nb'));
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
    expect(screen.getByText('nb.noun.def.sg')).toBeInTheDocument();
    for (const toggle of screen.getAllByRole('switch')) expect(toggle).toBeChecked();
  });

  it('keeps the pack’s order whatever order the slots are clicked in', async () => {
    const { last } = draw(emptyContent('nb'));
    await userEvent.click(screen.getByRole('switch', { name: 'Ubestemt flertall in the table' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Bestemt entall in the table' }));
    expect(last().slots).toEqual(['indefSg', 'defPl']);
    await userEvent.click(screen.getByRole('switch', { name: 'Ubestemt flertall in the table' }));
    expect(last().slots).toEqual(['indefSg', 'indefPl', 'defPl']);
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
  });

  it('warns, in step 1, when fewer than two slots are left', async () => {
    draw(emptyContent('nb'));
    for (const name of ['Bestemt entall', 'Ubestemt flertall', 'Bestemt flertall']) {
      await userEvent.click(screen.getByRole('switch', { name: `${name} in the table` }));
    }
    expect(screen.getByText(/at least two slots/)).toBeInTheDocument();
  });
});

describe('StepParadigm — switching the part of speech (IT-B4)', () => {
  it('switches at once, and swaps the columns, when there are no rows', async () => {
    const { last } = draw(emptyContent('nb'));
    await userEvent.click(screen.getByRole('button', { name: /^Verb/ }));
    expect(last().paradigmId).toBe('verb');
    expect(last().slots).toEqual(['inf', 'pres', 'pret', 'perf']);
    expect(screen.queryByText(/Switch to/)).not.toBeInTheDocument();
  });

  it('asks first when there are rows, naming how many go — and changes nothing yet', async () => {
    const { spy } = draw(addManualRow(addManualRow(emptyContent('nb'))));
    await userEvent.click(screen.getByRole('button', { name: /^Verb/ }));
    expect(screen.getByText('Switch to Verb?')).toBeInTheDocument();
    expect(screen.getByText(/2 rows written for the old ones go with them/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps the table when the author cancels', async () => {
    const { spy } = draw(addManualRow(emptyContent('nb')));
    await userEvent.click(screen.getByRole('button', { name: /^Verb/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Switch to Verb?')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Substantiv/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clears the rows and swaps the columns when the author confirms', async () => {
    const { last } = draw(sampleContent());
    await userEvent.click(screen.getByRole('button', { name: /^Verb/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Switch and clear' }));
    expect(last().paradigmId).toBe('verb');
    expect(last().rows).toEqual([]);
    expect(last().slots).toEqual(['inf', 'pres', 'pret', 'perf']);
  });

  it('does nothing when the paradigm already in use is clicked', async () => {
    const { spy } = draw(sampleContent());
    await userEvent.click(screen.getByRole('button', { name: /^Substantiv/ }));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByText(/Switch to/)).not.toBeInTheDocument();
  });
});

describe('StepParadigm — instruction', () => {
  it('shows the pack’s placeholder and writes what the author types', async () => {
    const { last } = draw(emptyContent('nb'));
    const field = screen.getByRole('textbox', { name: 'Instructions to the student' });
    expect(field).toHaveAttribute('placeholder', 'Fyll ut bøyingen.');
    await userEvent.type(field, 'Bøy.');
    expect(last().instruction).toBe('Bøy.');
  });
});

describe('StepParadigm — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = draw(emptyContent('nb'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });

  it('has none with the switch panel open or without a pack', async () => {
    const { container, unmount } = draw(addManualRow(emptyContent('nb')));
    await userEvent.click(screen.getByRole('button', { name: /^Verb/ }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    unmount();
    const bare = draw(emptyContent('xx'));
    expect((await axe.run(bare.container, PAGE_RULES)).violations).toEqual([]);
  });
});
