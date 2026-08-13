import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  spans,
  type ErrorCorrection,
  type Item,
} from '@/lib/shared-kernel/error-correction';

// The author's tester renders the student's runner over the same sentences, so it
// answers to the same text as the cards do. It has its own tests; here it is in the way.
vi.mock('./ec-tester', () => ({ EcTester: () => null }));

const { StepMistakes } = await import('./step-mistakes');

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

function renderStep(exercise: ErrorCorrection = doc()) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepMistakes exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepMistakes', () => {
  it('shows the mistake it read out of the two sentences, not one the author typed', () => {
    renderStep();

    // "I går jeg gikk" against "I går gikk jeg" is one word-order mistake, merged.
    expect(screen.getByText('jeg gikk')).toBeInTheDocument();
    expect(screen.getByText('gikk jeg')).toBeInTheDocument();
    expect(screen.getByText('1 mistake to find')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'word order', checked: true })).toBeInTheDocument();
  });

  it('overrides the kind of mistake without touching the sentences', async () => {
    const { onChange, user } = renderStep();
    const key = spans(PAIR, DEFAULT_CHECK)[0]!.key;

    await user.click(screen.getByRole('radio', { name: 'word form' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ meta: { [key]: { type: 'form' } } })],
      }),
    );
  });

  it('takes a mistake out of the count with “Accept both”', async () => {
    const { onChange, user } = renderStep();
    const key = spans(PAIR, DEFAULT_CHECK)[0]!.key;

    await user.click(screen.getByRole('button', { name: 'Accept both' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ meta: { [key]: { soft: true } } })],
      }),
    );
  });

  it('numbers hard mistakes and drops the number from a soft one', () => {
    const key = spans(PAIR, DEFAULT_CHECK)[0]!.key;
    renderStep(doc({ items: [{ ...PAIR, meta: { [key]: { soft: true } } }] }));

    expect(screen.queryByText('1 mistake to find')).not.toBeInTheDocument();
    expect(screen.getByText('nothing counts as a mistake')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Counts as a mistake' })).toBeInTheDocument();
  });

  it('says so when the two lines are the same, instead of listing nothing', () => {
    renderStep(doc({ items: [item('i1', 'Jeg gikk på kino.', 'Jeg gikk på kino.')] }));

    expect(screen.getByText(/two lines are the same/)).toBeInTheDocument();
    expect(screen.getByText('no difference')).toBeInTheDocument();
  });

  it('flags a sentence with no answer key on the card, not just in the gate', () => {
    renderStep(doc({ items: [item('i1', 'I går jeg gikk på kino.', '')] }));

    expect(screen.getByText('no answer key')).toBeInTheDocument();
    expect(screen.getByLabelText('How it should be')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the alternatives field typable while storing parsed lines', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await user.type(screen.getByLabelText('Other acceptable corrections'), 'Jeg dro på kino.');

    const last = onChange.mock.calls.at(-1)![0] as ErrorCorrection;
    expect(last.items[0]!.alts).toEqual(['Jeg dro på kino.']);
  });

  it('writes an explanation the student sees after grading', async () => {
    const { onChange, user } = renderStep();
    const key = spans(PAIR, DEFAULT_CHECK)[0]!.key;

    await user.type(screen.getByLabelText('Why “jeg gikk” is wrong'), 'V');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ meta: { [key]: { note: 'V' } } })],
      }),
    );
  });

  it('counts what is authored, so the author can see the set at a glance', () => {
    renderStep(
      doc({
        items: [
          PAIR,
          {
            ...item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.'),
            alts: ['Hun kjøpte en bil.'],
          },
          item('i3', '', ''),
        ],
      }),
    );

    // An item with nothing written in it is not counted — it is not authored yet.
    expect(screen.getByText('mistakes in total').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('sentences').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('with alternatives').nextSibling).toHaveTextContent('1');
  });

  it('edits only the text it is pointed at', async () => {
    const { onChange, user } = renderStep(
      doc({ items: [PAIR, item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.')] }),
    );

    await user.type(screen.getByLabelText('Sentence 2, with the mistake'), '!');

    const last = onChange.mock.calls.at(-1)![0] as ErrorCorrection;
    expect(last.items[1]!.wrong).toBe('Hun har kjøp en bil.!');
    expect(last.items[0]!.wrong).toBe(PAIR.wrong);
  });

  it('shows one text in passage mode, and no way to add a second', () => {
    renderStep(
      doc({
        mode: 'passage',
        items: [PAIR, item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.')],
      }),
    );

    expect(screen.getByLabelText('Text, with the mistake')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Hun har kjøp en bil.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add sentence/ })).not.toBeInTheDocument();
  });

  it('adds and deletes sentences', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: /Add sentence/ }));
    expect((onChange.mock.calls.at(-1)![0] as ErrorCorrection).items).toHaveLength(2);

    const card = screen.getByText('1 mistake to find').closest('div')!;
    await user.click(within(card).getByRole('button', { name: 'Delete' }));
    expect((onChange.mock.calls.at(-1)![0] as ErrorCorrection).items).toHaveLength(0);
  });
});
