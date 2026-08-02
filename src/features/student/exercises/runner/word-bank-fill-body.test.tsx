import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { PRACTICE_ACCENT } from './types';
import {
  WordBankFillBody,
  missedBlanksWithRationale,
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

const RATIONALE = {
  explanation: 'A statement is introduced by «at».',
  options: [
    { text: 'show off', verdict: 'correct' as const, note: 'The set phrase.' },
    { text: 'boast', verdict: 'wrong' as const, note: 'Too formal here.' },
  ],
};

describe('missedBlanksWithRationale', () => {
  it('returns only missed blanks that carry a rationale', () => {
    const missed = missedBlanksWithRationale(
      content.items,
      { '1': { 1: 'boast' }, '2': { 1: 'show off', 2: 'boast' } },
      {
        '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } },
        '2': {
          // correct → skipped even though a rationale is authored
          1: { correct: true, expected: 'show off', rationale: RATIONALE },
          // missed but nothing authored → nothing to show
          2: { correct: false, expected: 'clicked with' },
        },
      },
    );

    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ itemId: '1', blankId: 1, chosen: 'boast', itemNumber: 1 });
  });

  it('flags sentences with several blanks so the label can name which one', () => {
    const missed = missedBlanksWithRationale(
      content.items,
      { '2': { 2: 'boast' } },
      { '2': { 2: { correct: false, expected: 'clicked with', rationale: RATIONALE } } },
    );

    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ itemNumber: 2, blankId: 2, numbered: true });
  });

  it('is empty when the exercise was answered correctly', () => {
    expect(
      missedBlanksWithRationale(
        content.items,
        { '1': { 1: 'show off' } },
        { '1': { 1: { correct: true, expected: 'show off', rationale: RATIONALE } } },
      ),
    ).toEqual([]);
  });
});

describe('WordBankFillBody — per-blank rationale', () => {
  it('explains a missed blank and names its sentence', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } } },
    });

    expect(screen.getByText('A statement is introduced by «at».')).toBeInTheDocument();
    expect(screen.getByText(/Sentence 1/)).toBeInTheDocument();
    expect(screen.getByText('Too formal here.')).toBeInTheDocument();
    // the learner's pick is marked, as in the single-blank template
    expect(screen.getByText('Your answer')).toBeInTheDocument();
  });

  it('names the blank too when the sentence holds more than one', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '2': { 2: 'boast' } },
      results: { '2': { 2: { correct: false, expected: 'clicked with', rationale: RATIONALE } } },
    });

    expect(screen.getByText(/Sentence 2, blank 2/)).toBeInTheDocument();
  });

  it('stays silent while answering and when every blank was right', () => {
    const results = {
      '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } },
    };

    renderBody({ phase: 'answering', ok: null, value: { '1': { 1: 'boast' } }, results });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    renderBody({
      phase: 'feedback',
      ok: true,
      value: { '1': { 1: 'show off' } },
      results: { '1': { 1: { correct: true, expected: 'show off', rationale: RATIONALE } } },
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('WordBankFillBody — reusable words', () => {
  const picked: WordBankFillValue = { '1': { 1: 'show off' } };

  function bankWord(word: string) {
    // The bank chip lives in the labelled container above the sentence list.
    return within(screen.getByLabelText('Word bank')).getByText(word);
  }

  it('dims a spent word by default — one bank word per blank', () => {
    renderBody({ value: picked });
    expect(bankWord('show off').getAttribute('style')).toContain('opacity: 0.4');
  });

  it('keeps every word lit when the drill reuses them across blanks', () => {
    renderBody({ content: { ...content, reusableWords: true }, value: picked });
    expect(bankWord('show off').getAttribute('style')).toContain('opacity: 1');
  });
});
