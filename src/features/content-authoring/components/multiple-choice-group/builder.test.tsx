import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceGroupContent } from '@/lib/shared-kernel/multiple-choice-group';
import {
  exercise,
  row,
  settings,
  RIGHT,
  WRONG,
} from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import type { MultipleChoiceGroupDocument } from './edits';

vi.mock('../../actions/multiple-choice-group', () => ({ saveMultipleChoiceGroupAction: vi.fn() }));

const { MultipleChoiceGroupBuilder } = await import('./builder');
const { saveMultipleChoiceGroupAction } = await import('../../actions/multiple-choice-group');

const LOADED_AT = '2026-08-29T10:00:00.000Z';

/** A table with nothing left to fix, so a test can add exactly one problem. */
function doc(overrides: Partial<MultipleChoiceGroupContent> = {}): MultipleChoiceGroupDocument {
  return { updatedAt: LOADED_AT, ...exercise(overrides) };
}

function renderBuilder(document: MultipleChoiceGroupDocument = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MultipleChoiceGroupBuilder
        exerciseId="ex-1"
        containerId="module-1"
        targetLanguage="nb"
        initialExercise={document}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

/** The gate, from where an author reaches it: the last step's own way forward. */
async function openGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /Feedback/ }));
  await user.click(screen.getByRole('button', { name: /Review & finish/ }));
}

beforeEach(() => {
  vi.mocked(saveMultipleChoiceGroupAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-29T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MultipleChoiceGroupBuilder', () => {
  it('opens on the setup', () => {
    renderBuilder();

    expect(screen.getByRole('tab', { name: /Setup/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows a clean rail when the table has nothing left to fix', () => {
    renderBuilder();

    for (const step of ['Setup', 'Statements', 'Difficulty', 'Feedback']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('ready'),
      ).toBeInTheDocument();
    }
  });

  it('says "empty" on step 2 of an untouched table rather than telling the author off', () => {
    renderBuilder(doc({ rows: [row(''), row(''), row(''), row('')] }));

    // B5: the scaffold's four blank rows are not a mistake. The gate still refuses the
    // document — that is the next test — because the two questions are asked by two
    // different functions (plan 54 §5, deviation 5).
    expect(
      within(screen.getByRole('tab', { name: /Statements/ })).getByText('empty'),
    ).toBeInTheDocument();
  });

  it('refuses an untouched table at the gate all the same', async () => {
    const { user } = renderBuilder(doc({ rows: [row(''), row(''), row(''), row('')] }));

    await openGate(user);

    expect(screen.getByText(/Not one statement is finished/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();
  });

  it('counts a statement with no answer on step 2 and an unnamed column on step 1', () => {
    renderBuilder(
      doc({
        columns: [RIGHT, { id: WRONG.id, label: '  ', short: 'G' }],
        rows: [row('Uten svar.'), row('Med svar.', RIGHT.id, { why: 'Fordi.' })],
      }),
    );

    expect(
      within(screen.getByRole('tab', { name: /Setup/ })).getByText('1 problem'),
    ).toBeInTheDocument();
    // Two on step 2: the statement has no answer, and with it the table has fewer than
    // two finished rows.
    expect(
      within(screen.getByRole('tab', { name: /Statements/ })).getByText('2 problems'),
    ).toBeInTheDocument();
  });

  it('lets an author move between steps in any order', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /Difficulty/ }));

    expect(screen.getByRole('heading', { name: 'How much help' })).toBeInTheDocument();
  });

  it('names the statement a blocker is about, and sends the author to its step', async () => {
    const { user } = renderBuilder(
      doc({ rows: [row('Uten svar.'), row('En.', RIGHT.id), row('To.', WRONG.id)] }),
    );

    await openGate(user);

    expect(
      screen.getByText('Statement 1 — No answer marked — this statement will not be shown.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Statement 1/ }));

    expect(screen.getByRole('heading', { name: 'The statements' })).toBeInTheDocument();
  });

  it('clears the gate when nothing is wrong, and says what the table will do', async () => {
    const { user } = renderBuilder();

    await openGate(user);

    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
    expect(screen.getByText('4 finished statements over 2 columns')).toBeInTheDocument();
    expect(screen.getByText('Spread: Riktig 2 · Galt 2')).toBeInTheDocument();
    expect(screen.getByText('Pass mark 70% — 3 of 4 right')).toBeInTheDocument();
    expect(screen.getByText('One retry of the wrong rows')).toBeInTheDocument();
  });

  it('keeps an audit warning out of the way of assigning', async () => {
    const { user } = renderBuilder(
      doc({
        rows: [
          row('En.', RIGHT.id, { why: 'Fordi.' }),
          row('To.', RIGHT.id, { why: 'Fordi.' }),
          row('Tre.', RIGHT.id, { why: 'Fordi.' }),
          row('Fire.', RIGHT.id, { why: 'Fordi.' }),
        ],
      }),
    );

    await openGate(user);

    // The lopsided key is the failure mode of this type, and it is still the author's
    // call: reported, and nothing is stopped.
    expect(screen.getByText(/100% of the answers sit in this column/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });

  it('reports a step-3 contradiction in the gate as well as on the step', async () => {
    const { user } = renderBuilder(
      doc({ settings: settings({ retry: 'none', revealKey: false }) }),
    );

    await openGate(user);

    expect(screen.getByText(/never learn what was wrong/)).toBeInTheDocument();
  });

  it('saves what was typed, both columns and the token it started from', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByRole('textbox', { name: 'Exercise title' }), '!');
    await vi.waitFor(() => expect(saveMultipleChoiceGroupAction).toHaveBeenCalled(), {
      timeout: 3000,
    });

    const [, , input] = vi.mocked(saveMultipleChoiceGroupAction).mock.calls.at(-1)!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.rows[0]!.text).toBe('Statement one.');
    // The key is only ever in the other column: nothing in `content` says which column a
    // statement belongs in, nor carries the line or the quote that would give it away.
    expect(JSON.stringify(input.content)).not.toContain('answer');
    expect(JSON.stringify(input.content)).not.toContain('Because one.');
    expect(input.expectedAnswers.rows[input.content.rows[0]!.id]!.answer).toBe(RIGHT.id);
  });

  it('offers to undo everything typed since the page opened', async () => {
    const { user } = renderBuilder();

    expect(screen.queryByRole('button', { name: /Undo everything/ })).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Exercise title' }), '!');

    expect(screen.getByRole('button', { name: /Undo everything/ })).toBeInTheDocument();
  });
});
