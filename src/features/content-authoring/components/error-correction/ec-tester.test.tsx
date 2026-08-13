import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  type ErrorCorrection,
  type Item,
} from '@/lib/shared-kernel/error-correction';

import { EcTester } from './ec-tester';

const item = (id: string, wrong: string, ref: string): Item => ({
  id,
  wrong,
  ref,
  alts: [],
  meta: {},
});

const PAIR = item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.');

function doc(overrides: Partial<ErrorCorrection> = {}): ErrorCorrection {
  return {
    id: 'ex-1',
    type: 'error_correction',
    moduleId: 'module-1',
    title: '',
    instructions: 'Finn feilen.',
    mode: 'sentences',
    note: '',
    items: [PAIR],
    hints: { ...DEFAULT_HINTS },
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
    updatedAt: '2026-08-12T10:00:00.000Z',
    ...overrides,
  };
}

function renderTester(exercise: ErrorCorrection = doc()) {
  const { rerender } = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <EcTester exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return {
    user: userEvent.setup(),
    update: (next: ErrorCorrection) =>
      rerender(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <EcTester exercise={next} />
        </NextIntlClientProvider>,
      ),
  };
}

/**
 * Rewrite one word the way a student would: tap it, type, press Enter.
 *
 * By position, because a word's accessible name is what it currently shows — rewriting
 * "jeg" into "gikk" leaves two words called "gikk" on screen.
 */
async function rewrite(
  user: ReturnType<typeof userEvent.setup>,
  shown: string,
  into: string,
  occurrence = 0,
) {
  const words = screen.getAllByRole('button', { name: `Word: ${shown}` });
  await user.click(words[occurrence]!);
  const field = screen.getByRole('textbox');
  await user.clear(field);
  await user.type(field, `${into}{Enter}`);
}

describe('EcTester', () => {
  it('says nothing about a verdict until the author has tried something', () => {
    renderTester();

    expect(screen.getByText(/Correct it here/)).toBeInTheDocument();
    expect(screen.queryByText('goes to the teacher')).not.toBeInTheDocument();
  });

  it('approves the corrected sentence without a teacher', async () => {
    const { user } = renderTester();

    await rewrite(user, 'jeg', 'gikk');
    // The original "gikk" is now the second word by that name.
    await rewrite(user, 'gikk', 'jeg', 1);

    expect(screen.getByText('All correct')).toBeInTheDocument();
    expect(screen.getByText('approved without a teacher')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 mistakes corrected')).toBeInTheDocument();
    expect(screen.getByText('I går gikk jeg på kino.')).toBeInTheDocument();
  });

  it('sends a half-corrected sentence to the teacher, with the diff', async () => {
    const { user } = renderTester();

    await rewrite(user, 'jeg', 'gikk');

    expect(screen.getByText('goes to the teacher')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 mistakes corrected')).toBeInTheDocument();
    // The diff is the sentence against the key, so the words the key wants are in it.
    expect(screen.getByLabelText('The sentence against the answer key')).toBeInTheDocument();
  });

  it('names what was changed where there was no mistake, and what that costs', async () => {
    const { user } = renderTester();

    await rewrite(user, 'kino.', 'teater.');

    expect(screen.getByText(/Changed outside the mistakes: «kino.»/)).toBeInTheDocument();
    expect(screen.getByText(/the teacher is shown what else was touched/)).toBeInTheDocument();
  });

  it('drops the trial when the sentence under it is rewritten', async () => {
    // A verdict left standing over edited words would be a verdict on a sentence that is
    // no longer there — and the author would read it as the one they are looking at.
    const { user, update } = renderTester();
    await rewrite(user, 'jeg', 'gikk');
    expect(screen.getByText('goes to the teacher')).toBeInTheDocument();

    update(doc({ items: [{ ...PAIR, wrong: 'I går jeg dro på kino.' }] }));

    expect(screen.getByText(/Correct it here/)).toBeInTheDocument();
    expect(screen.queryByText('goes to the teacher')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Word: jeg' })).toBeInTheDocument();
  });

  it('lets the author pick which sentence to try, and only then', async () => {
    renderTester(
      doc({ items: [PAIR, item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.')] }),
    );

    const picker = screen.getByLabelText('Which sentence to try');
    expect(picker).toBeInTheDocument();

    await userEvent.setup().selectOptions(picker, '1');
    expect(screen.getByRole('button', { name: 'Word: kjøp' })).toBeInTheDocument();
  });

  it('never passes when the auto-check is off, however right the answer is', async () => {
    const { user } = renderTester(doc({ check: { ...DEFAULT_CHECK, on: false } }));

    await rewrite(user, 'jeg', 'gikk');
    await rewrite(user, 'gikk', 'jeg', 1);

    expect(screen.getByText('All correct')).toBeInTheDocument();
    expect(screen.getByText('goes to the teacher')).toBeInTheDocument();
  });
});
