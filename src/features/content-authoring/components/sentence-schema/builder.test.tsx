import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';
import {
  chunk,
  content,
  row,
  schema,
} from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';

import type { SentenceSchemaDocument } from './edits';

vi.mock('../../actions/sentence-schema', () => ({ saveSentenceSchemaAction: vi.fn() }));

const { SentenceSchemaBuilder } = await import('./builder');
const { saveSentenceSchemaAction } = await import('../../actions/sentence-schema');

const LOADED_AT = '2026-08-26T10:00:00.000Z';

/**
 * A document with nothing left to fix, so a test can add exactly one problem.
 *
 * The distractor is not decoration: `extras` is on by default, and a set where no sentence
 * has one raises the step-3 warning — so a fixture without it would open on an amber dot
 * and every "clean rail" assertion would be about the wrong thing.
 */
function doc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaDocument {
  const base = content({ rows: [row({ extras: [{ id: 'x1', text: 'boken' }] })] });
  return { updatedAt: LOADED_AT, ...base, ...overrides };
}

function renderBuilder(exercise: SentenceSchemaDocument = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SentenceSchemaBuilder exerciseId="ex-1" containerId="module-1" initialExercise={exercise} />
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
  vi.mocked(saveSentenceSchemaAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-26T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SentenceSchemaBuilder', () => {
  it('opens on the sentences, where the work is', () => {
    renderBuilder();

    expect(screen.getByRole('tab', { name: /Sentences/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows a clean rail when the document has nothing left to fix', () => {
    renderBuilder();

    for (const step of ['Schema', 'Sentences', 'Difficulty', 'Feedback']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('ready'),
      ).toBeInTheDocument();
    }
  });

  it('marks the step that holds a blocker, and reaches it in one click', async () => {
    const { user } = renderBuilder(doc({ rows: [row({ why: '' })] }));

    const feedback = screen.getByRole('tab', { name: /Feedback/ });
    expect(within(feedback).getByText('1 problem')).toBeInTheDocument();

    await user.click(feedback);
    expect(feedback).toHaveAttribute('aria-selected', 'true');
  });

  it('counts an unplaced word as a step-2 blocker and refuses to let the gate pass', async () => {
    // Two blockers, not one: the word outside the schema, and — because it is the only
    // sentence — a set with nothing a student could be given.
    const { user } = renderBuilder(
      doc({
        rows: [
          row({
            chunks: [chunk('c1', 'I morgen', 'F'), chunk('c2', 'skal')],
            extras: [{ id: 'x1', text: 'boken' }],
          }),
        ],
      }),
    );

    expect(
      within(screen.getByRole('tab', { name: /Sentences/ })).getByText('2 problems'),
    ).toBeInTheDocument();

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Sentence 1 has 1 word outside the schema.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'No sentence is finished, so there is nothing for a student to solve.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 2 problems first/ })).toBeDisabled();
  });

  it('lists warnings under the blockers without blocking on them', async () => {
    // A main clause with two pieces in the first field: the V2 warning.
    const { user } = renderBuilder(
      doc({
        rows: [
          row({
            text: 'I morgen skal jeg',
            chunks: [chunk('c1', 'I', 'F'), chunk('c2', 'morgen', 'F'), chunk('c3', 'skal', 'v')],
            extras: [{ id: 'x1', text: 'boken' }],
          }),
        ],
      }),
    );

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Sentence 1 puts 2 pieces in Forfelt. A main clause takes one element there — join the words that belong together.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });

  it('deep-links a gate row to its own step and closes the modal', async () => {
    const { user } = renderBuilder(doc({ clauses: [], schema: schema() }));

    await openGate(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /No clause type/ }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Schema/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('states what the exercise will do, in the author’s own numbers', async () => {
    const { user } = renderBuilder(
      doc({
        rows: [
          row({
            chunks: [chunk('c1', 'I morgen', 'F', ['a'])],
            fb: { c1: 'V2.' },
            extras: [{ id: 'x1', text: 'boken' }],
          }),
        ],
      }),
    );

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('1 sentence ready to play')).toBeInTheDocument();
    expect(within(dialog).getByText('Clause types used: Main clause')).toBeInTheDocument();
    expect(
      within(dialog).getByText('1 sentence accepts a chunk in more than one field'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('1 chunk-level note written')).toBeInTheDocument();
    expect(within(dialog).getByText('Order inside a field is graded')).toBeInTheDocument();
  });

  it('offers no way back until something has been typed', async () => {
    const { user } = renderBuilder();

    expect(
      screen.queryByRole('button', { name: /Undo everything since I opened this/ }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Exercise title'), '!');

    expect(
      screen.getByRole('button', { name: /Undo everything since I opened this/ }),
    ).toBeInTheDocument();
  });

  it('puts the document back where it was found, keeping the row’s token', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Exercise title'), '!');
    await user.click(screen.getByRole('button', { name: /Undo everything since I opened this/ }));
    await user.click(screen.getByRole('button', { name: 'Put it back' }));

    expect(screen.getByLabelText('Exercise title')).toHaveValue('Ordstilling');
  });
});
