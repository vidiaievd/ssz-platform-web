import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { PRACTICE_ACCENT } from './types';
import {
  WordBankFillBody,
  parseSentence,
  type WordBankFillContent,
  type WordBankFillValue,
} from './word-bank-fill-body';

const content: WordBankFillContent = {
  wordBank: ['show off', 'boast', 'clicked with'],
  items: [
    { id: '1', textWithBlanks: 'I hate it when people ___1___ all the time.' },
    { id: '2', textWithBlanks: 'I ___1___ her immediately and we ___2___ each other.' },
  ],
  instruction: 'Complete the sentences.',
};

function renderBody(props: Partial<React.ComponentProps<typeof WordBankFillBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordBankFillBody
        content={content}
        value={{}}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        ok={null}
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('parseSentence', () => {
  it('splits text around numbered blanks', () => {
    expect(parseSentence('a ___1___ b ___2___')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'blank', blankId: 1 },
      { kind: 'text', text: ' b ' },
      { kind: 'blank', blankId: 2 },
    ]);
  });

  it('returns the whole string when there is no blank', () => {
    expect(parseSentence('no blanks here')).toEqual([{ kind: 'text', text: 'no blanks here' }]);
  });
});

describe('WordBankFillBody', () => {
  it('renders one select per blank, each offering the whole bank', () => {
    renderBody();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3); // 1 + 2 blanks
    expect(screen.getAllByRole('option', { name: 'boast' })).toHaveLength(3);
  });

  it('reports the chosen word for the right sentence and blank', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.change(screen.getAllByRole('combobox')[2]!, { target: { value: 'boast' } });

    expect(onValueChange).toHaveBeenCalledWith({ '2': { 2: 'boast' } });
  });

  it('enables submitting only once every blank is filled', () => {
    const onAnswerChange = vi.fn();
    const partial: WordBankFillValue = { '1': { 1: 'show off' } };
    const { rerender } = renderBody({ value: partial, onAnswerChange });

    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('1 of 3 blanks filled')).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WordBankFillBody
          content={content}
          value={{ '1': { 1: 'show off' }, '2': { 1: 'boast', 2: 'clicked with' } }}
          onValueChange={vi.fn()}
          onAnswerChange={onAnswerChange}
          phase="answering"
          ok={null}
          mode="practice"
          accent={PRACTICE_ACCENT}
        />
      </NextIntlClientProvider>,
    );

    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('shows the expected answer next to a wrong pick in the feedback phase', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off' } } },
    });

    // The pick is no longer editable…
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // …and the correction sits beside it inside the sentence (the bank above
    // lists both words too, hence scoping to the sentence list).
    const sentence = screen.getByRole('list').textContent ?? '';
    expect(sentence).toContain('boast');
    expect(sentence).toContain('show off');
  });
});
