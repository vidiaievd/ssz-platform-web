import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceContent } from '@/lib/shared-kernel/multiple-choice';
import {
  content,
  option,
  question,
  settings,
} from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import type { MultipleChoiceDocument } from './edits';

vi.mock('../../actions/multiple-choice', () => ({ saveMultipleChoiceAction: vi.fn() }));

const { MultipleChoiceBuilder } = await import('./builder');
const { saveMultipleChoiceAction } = await import('../../actions/multiple-choice');

const LOADED_AT = '2026-08-28T10:00:00.000Z';

/**
 * A document with nothing left to fix, so a test can add exactly one problem.
 *
 * Four options rather than the fixture's three: three is fine for the blockers, but two
 * of the audit's checks are about how the key compares with its distractors, and a set
 * that already carries a warning would make every "clean rail" assertion about the wrong
 * thing.
 */
function doc(overrides: Partial<MultipleChoiceContent> = {}): MultipleChoiceDocument {
  const base = content({
    questions: [
      question({
        options: [
          option({ id: 'a', text: 'er', why: 'Presens holder ikke etter «sa».' }),
          option({ id: 'b', text: 'var', correct: true }),
          option({ id: 'c', text: 'har vært' }),
        ],
      }),
    ],
    ...overrides,
  });
  return { updatedAt: LOADED_AT, ...base };
}

function renderBuilder(exercise: MultipleChoiceDocument = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MultipleChoiceBuilder
        exerciseId="ex-1"
        containerId="module-1"
        targetLanguage="nb"
        initialExercise={exercise}
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
  vi.mocked(saveMultipleChoiceAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-28T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MultipleChoiceBuilder', () => {
  it('opens on the questions', () => {
    renderBuilder();

    expect(screen.getByRole('tab', { name: /Questions/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows a clean rail when the document has nothing left to fix', () => {
    renderBuilder();

    for (const step of ['Questions', 'Distractors', 'Difficulty', 'Feedback']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('ready'),
      ).toBeInTheDocument();
    }
  });

  it('counts a missing rule on step 4 and a missing stem on step 1', () => {
    renderBuilder(doc({ questions: [question({ stem: '', why: '' })] }));

    // Two on step 1: the question has no text, and with it the set has no finished
    // question at all — a separate blocker, because a document can have every card
    // half-written and no single card that would render.
    expect(
      within(screen.getByRole('tab', { name: /Questions/ })).getByText('2 problems'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tab', { name: /Feedback/ })).getByText('1 problem'),
    ).toBeInTheDocument();
  });

  it('lets an author move between steps in any order', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /Difficulty/ }));

    expect(screen.getByRole('heading', { name: 'Difficulty' })).toBeInTheDocument();
  });

  it('names the question a blocker is about, and sends the author to its step', async () => {
    const { user } = renderBuilder(doc({ questions: [question({ why: '' })] }));

    await openGate(user);

    expect(screen.getByText('Question 1 — Write the rule behind the right answer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Question 1/ }));

    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
  });

  it('blocks the gate while a blocker stands', async () => {
    const { user } = renderBuilder(doc({ questions: [question({ stem: '' })] }));

    await openGate(user);

    // Two blockers on one card: no stem, and with it no finished question in the set.
    expect(screen.getByRole('button', { name: /Fix 2 problems first/ })).toBeDisabled();
  });

  it('clears the gate when nothing is wrong, and says what the set will do', async () => {
    const { user } = renderBuilder();

    await openGate(user);

    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
    expect(screen.getByText('1 finished question, 3.0 options each on average')).toBeInTheDocument();
    expect(screen.getByText('Types covered: Grammar')).toBeInTheDocument();
    expect(screen.getByText('One retry per question')).toBeInTheDocument();
  });

  it('keeps an audit warning out of the way of assigning', async () => {
    const { user } = renderBuilder(
      doc({
        questions: [
          question({
            options: [
              option({ id: 'a', text: 'Riktig', correct: true }),
              option({ id: 'b', text: 'Galt', why: 'Setningen sier det motsatte.' }),
            ],
          }),
        ],
      }),
    );

    await openGate(user);

    // Q6 in one assertion: the coin-flip warning is reported and does not stop anything.
    expect(screen.getByText(/Two options is a coin flip/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });

  it('reports a step-3 contradiction in the gate as well as on the step', async () => {
    const { user } = renderBuilder(doc({ settings: settings({ instant: true, retry: 'one' }) }));

    await openGate(user);

    expect(screen.getByText(/tap until one turns green/)).toBeInTheDocument();
  });

  it('saves what was typed, both columns and the token it started from', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByRole('textbox', { name: 'Exercise title' }), '!');
    await vi.waitFor(() => expect(saveMultipleChoiceAction).toHaveBeenCalled(), { timeout: 3000 });

    const [, , input] = vi.mocked(saveMultipleChoiceAction).mock.calls.at(-1)!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.questions[0]!.stem).toBe('Han sa at han ___ syk.');
    // The key is only ever in the other column: nothing in `content` says which option is
    // right, so a projection cannot leak it by forgetting to strip a flag.
    expect(JSON.stringify(input.content)).not.toContain('correct');
    expect(input.expectedAnswers.questions['q1']!.correctOptionId).toBe('b');
  });

  it('offers to undo everything typed since the page opened', async () => {
    const { user } = renderBuilder();

    expect(screen.queryByRole('button', { name: /Undo everything/ })).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Exercise title' }), '!');

    expect(screen.getByRole('button', { name: /Undo everything/ })).toBeInTheDocument();
  });
});
