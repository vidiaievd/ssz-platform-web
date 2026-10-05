import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  addManualRow,
  emptyContent,
  IT_MAX_ROWS,
  sampleContent,
  type DictionaryEntry,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

const dictionary = vi.hoisted(() => ({
  state: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    isSuccess: true,
  },
  calls: [] as unknown[][],
}));
vi.mock('../../api/use-course-dictionary', () => ({
  useCourseDictionary: (...args: unknown[]) => {
    dictionary.calls.push(args);
    return dictionary.state;
  },
}));

const { StepForms } = await import('./step-forms');

const SOKNAD: DictionaryEntry = {
  id: 'v1',
  word: 'søknad',
  pos: 'NOUN',
  gloss: 'application',
  unit: 'Leksjon 1 · 1A',
  properties: {
    gender: 'masculine',
    definite_singular: 'søknaden',
    plural_form: 'søknader',
    definite_plural: 'søknadene',
  },
};
const BOK: DictionaryEntry = {
  id: 'v2',
  word: 'bok',
  pos: 'NOUN',
  gloss: 'book',
  unit: 'Leksjon 2 · 2B',
  properties: { gender: 'feminine', definite_singular: 'boka', plural_form: 'bøker' },
};
const SOKE: DictionaryEntry = {
  id: 'v3',
  word: 'søke',
  pos: 'VERB',
  gloss: 'to apply',
  unit: 'Leksjon 1 · 1A',
  properties: { present_tense: 'søker' },
};

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
    <StepForms
      exerciseId="ex-1"
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
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness initial={initial} spy={spy} goTo={goTo} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return {
    ...view,
    spy,
    goTo,
    user: userEvent.setup(),
    last: () => spy.mock.calls.at(-1)?.[0] as InflectionTableContent,
  };
}

const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };

/** A table of `n` hand-typed rows in the noun paradigm. */
function withRows(n: number): InflectionTableContent {
  let ex = emptyContent('nb');
  for (let i = 0; i < n; i += 1) ex = addManualRow(ex);
  return ex;
}

beforeEach(() => {
  dictionary.state = {
    data: [SOKNAD, BOK, SOKE],
    isPending: false,
    isError: false,
    isSuccess: true,
  };
  dictionary.calls = [];
});

describe('StepForms — the grid', () => {
  it('shows the empty state, with the dictionary button, before any lemma', () => {
    draw(emptyContent('nb'));
    expect(screen.getByText('No lemmas yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'From course dictionary' })).toHaveLength(2);
  });

  it('heads the grid with the pack’s lemma label and the slots in play, atom under each', () => {
    draw(sampleContent());
    const table = screen.getByRole('table', { name: 'The inflection table' });
    expect(within(table).getByRole('columnheader', { name: 'Ordbokform' })).toBeInTheDocument();
    for (const label of [
      'Ubestemt entall',
      'Bestemt entall',
      'Ubestemt flertall',
      'Bestemt flertall',
    ]) {
      expect(
        within(table).getByRole('columnheader', { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    expect(within(table).getByText('nb.noun.def.pl')).toBeInTheDocument();
  });

  it('leaves out the columns of a slot switched off, and keeps their cells', () => {
    const base = sampleContent();
    const ex = { ...base, slots: ['indefSg', 'defSg'] };
    draw(ex);
    expect(
      screen.queryByRole('columnheader', { name: /Bestemt flertall/ }),
    ).not.toBeInTheDocument();
    expect(ex.rows[0]?.cells['defPl']).toBeDefined();
  });

  it('writes the lemma and a form as the author types', async () => {
    const { user, last } = draw(withRows(1));
    await user.type(screen.getByRole('textbox', { name: 'Lemma of row 1' }), 'en jobb');
    expect(last().rows[0]?.lemma).toBe('en jobb');
    await user.type(screen.getByRole('textbox', { name: /^en jobb · Bestemt entall$/ }), 'jobben');
    expect(last().rows[0]?.cells['defSg']?.value).toBe('jobben');
  });

  it('removes a row', async () => {
    const { user, last } = draw(sampleContent());
    const before = last()?.rows.length ?? sampleContent().rows.length;
    await user.click(screen.getAllByRole('button', { name: 'Remove row' })[0]!);
    expect(last().rows).toHaveLength(sampleContent().rows.length - 1);
    expect(before).toBeGreaterThan(0);
  });
});

describe('StepForms — given and asked', () => {
  it('starts a typed row with the first column given and the rest asked', async () => {
    const { user, last } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'Type a lemma' })[0]!);
    const cells = last().rows[0]!.cells;
    expect(cells['indefSg']?.mode).toBe('prefill');
    expect(cells['defSg']?.mode).toBe('ask');
  });

  it('flips a cell with its marker, and says which it is', async () => {
    const { user, last } = draw(withRows(1));
    const marker = (name: RegExp) => screen.getByRole('button', { name });
    const given = marker(/^Given — click to ask it —.*Ubestemt entall$/);
    expect(given).toHaveAttribute('aria-pressed', 'false');
    await user.click(given);
    expect(last().rows[0]?.cells['indefSg']?.mode).toBe('ask');
    expect(marker(/^Asked — click to give it —.*Ubestemt entall$/)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('«Open everything» asks every cell and «First column given» restores the first', async () => {
    const { user, last } = draw(sampleContent());
    await user.click(screen.getByRole('button', { name: 'Open everything' }));
    expect(last().rows.every((r) => Object.values(r.cells).every((c) => c.mode === 'ask'))).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: 'First column given' }));
    expect(last().rows.every((r) => r.cells['indefSg']?.mode === 'prefill')).toBe(true);
    expect(last().rows.every((r) => r.cells['defSg']?.mode === 'ask')).toBe(true);
  });

  it('marks an asked cell with no key red, and a given or keyed one not', () => {
    const base = withRows(1);
    const row = base.rows[0]!;
    const ex = {
      ...base,
      rows: [
        {
          ...row,
          lemma: 'en jobb',
          cells: {
            ...row.cells,
            defSg: { ...row.cells['defSg']!, value: 'jobben' },
          },
        },
      ],
    };
    const { container } = draw(ex);
    const flags = [...container.querySelectorAll('td[data-mode]')].map((td) => [
      td.getAttribute('data-mode'),
      td.getAttribute('data-bad'),
    ]);
    expect(flags).toEqual([
      ['prefill', null],
      ['ask', null],
      ['ask', 'true'],
      ['ask', 'true'],
    ]);
    expect(screen.getAllByRole('textbox', { name: / · Ubestemt flertall$/ })[0]).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a dot on an asked cell that has a reason', () => {
    const base = sampleContent();
    const row = base.rows[0]!;
    draw({
      ...base,
      rows: [
        { ...row, cells: { ...row.cells, defSg: { ...row.cells['defSg']!, why: 'Hankjønn.' } } },
        ...base.rows.slice(1),
      ],
    });
    expect(screen.getAllByRole('img', { name: 'Has a reason' }).length).toBeGreaterThan(0);
  });
});

describe('StepForms — the ceiling (IT-B6)', () => {
  it('disables «Type a lemma» at ten rows and refuses an eleventh', async () => {
    const { user, spy } = draw(withRows(IT_MAX_ROWS));
    const button = screen.getAllByRole('button', { name: 'Type a lemma' })[0]!;
    expect(button).toBeDisabled();
    await user.click(button);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('StepForms — coverage and the way on', () => {
  it('reports asked, keyed and reasoned cells, and carries on to step 3', async () => {
    const { user, goTo } = draw(sampleContent());
    const total = sampleContent().rows.length * 4;
    expect(screen.getByText(new RegExp(`/ ${total} cells asked`))).toBeInTheDocument();
    expect(screen.getByText(/have a key · \d+ have a reason/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reasons' }));
    expect(goTo).toHaveBeenCalledWith(3);
  });

  it('draws what the issue list says about a row under its lemma', () => {
    const base = sampleContent();
    const row = base.rows[0]!;
    const allGiven = Object.fromEntries(
      Object.entries(row.cells).map(([id, c]) => [id, { ...c, mode: 'prefill' as const }]),
    );
    draw({ ...base, rows: [{ ...row, cells: allGiven }, ...base.rows.slice(1)] });
    expect(screen.getByText(/fully prefilled — it reads as an example/)).toBeInTheDocument();
  });

  it('says a hand-typed row is not linked, and a dictionary row shows its gloss', () => {
    const base = sampleContent();
    draw({
      ...base,
      rows: [
        { ...base.rows[0]!, dictId: 'v9', gloss: 'job' },
        { ...base.rows[1]!, dictId: null },
      ],
    });
    expect(screen.getByText('job')).toBeInTheDocument();
    expect(screen.getByText('not linked')).toBeInTheDocument();
  });
});

describe('StepForms — the dictionary picker (IT-B5, IT-B7)', () => {
  it('asks the dictionary for the paradigm’s part of speech in the author’s language', async () => {
    const { user } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    expect(dictionary.calls.at(-1)).toEqual(['ex-1', 'NOUN', 'en', true]);
  });

  it('lists only words of that part of speech, with gloss, module and suggested forms', async () => {
    const { user } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add from the course dictionary' });
    expect(within(dialog).getByText('application · Leksjon 1 · 1A')).toBeInTheDocument();
    expect(
      within(dialog).getByText('søknad – søknaden – søknader – søknadene'),
    ).toBeInTheDocument();
    // The lemma carries the article its gender takes.
    expect(within(dialog).getByText('en søknad')).toBeInTheDocument();
    expect(within(dialog).getByText('ei bok')).toBeInTheDocument();
    expect(within(dialog).queryByText(/søke/)).not.toBeInTheDocument();
  });

  it('filters by what is typed, in the word or its gloss', async () => {
    const { user } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('searchbox'), 'book');
    expect(within(dialog).getByText('ei bok')).toBeInTheDocument();
    expect(within(dialog).queryByText('en søknad')).not.toBeInTheDocument();
    await user.clear(within(dialog).getByRole('searchbox'));
    await user.type(within(dialog).getByRole('searchbox'), 'zzz');
    expect(
      within(dialog).getByText('Nothing in this course’s dictionary matches.'),
    ).toBeInTheDocument();
  });

  it('adds a linked row with the forms as suggestions, first column given, and stays open', async () => {
    const { user, last } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add ei bok' }));
    const row = last().rows[0]!;
    expect(row).toMatchObject({ lemma: 'ei bok', gloss: 'book', dictId: 'v2' });
    expect(row.cells['defSg']).toMatchObject({ mode: 'ask', value: 'boka' });
    expect(row.cells['indefSg']).toMatchObject({ mode: 'prefill', value: 'bok' });
    // No suggestion for what the dictionary does not have — the cell is left for the author.
    expect(row.cells['defPl']).toMatchObject({ mode: 'ask', value: '' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows a word already in the table ticked and disabled', async () => {
    const base = emptyContent('nb');
    const { user } = draw({
      ...base,
      rows: [{ id: 'r1', lemma: 'ei bok', gloss: 'book', dictId: 'v2', cells: {} }],
    });
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'ei bok — Already in the table' }),
    ).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Add en søknad' })).toBeEnabled();
  });

  it('disables every entry at ten rows and says why (IT-B6)', async () => {
    const { user } = draw(withRows(IT_MAX_ROWS));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('A table holds at most 10 rows.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add ei bok' })).toBeDisabled();
  });

  it('says so when the dictionary cannot be read, and while it is being read', async () => {
    dictionary.state = { data: undefined, isPending: true, isError: false, isSuccess: false };
    const { user, unmount } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    expect(await screen.findByText('Reading the course dictionary…')).toBeInTheDocument();
    unmount();

    dictionary.state = { data: undefined, isPending: false, isError: true, isSuccess: false };
    const again = draw(emptyContent('nb'));
    await again.user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
  });

  it('closes with Done', async () => {
    const { user } = draw(emptyContent('nb'));
    await user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('StepForms — accessibility', () => {
  it('has no axe violations empty, with a table, or with the picker open', async () => {
    const empty = draw(emptyContent('nb'));
    expect((await axe.run(empty.container, PAGE_RULES)).violations).toEqual([]);
    empty.unmount();

    const full = draw(sampleContent());
    expect((await axe.run(full.container, PAGE_RULES)).violations).toEqual([]);
    await full.user.click(screen.getAllByRole('button', { name: 'From course dictionary' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect((await axe.run(dialog, PAGE_RULES)).violations).toEqual([]);
  });
});
