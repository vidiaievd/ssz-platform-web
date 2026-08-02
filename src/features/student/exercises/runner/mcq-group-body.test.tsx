import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { checkMcqGroup } from './grading';
import { McqGroupBody, keepCorrectPicks, type McqGroupContent } from './mcq-group-body';
import { PRACTICE_ACCENT } from './types';

/** A Riktig/Galt table: statements sharing one pair of options. */
const tableContent: McqGroupContent = {
  options: [
    { id: 'r', text: 'Riktig' },
    { id: 'g', text: 'Galt' },
  ],
  items: [
    { id: '1', question: 'Bartek er elektriker.' },
    { id: '2', question: 'Firmaet vil ha fem års erfaring.' },
  ],
  instruction: 'Riktig eller galt?',
};

/** Word meanings: every question brings its own options. */
const stackedContent: McqGroupContent = {
  items: [
    {
      id: '1',
      question: 'selvstendig',
      options: [
        { id: 'a', text: 'som trenger mye hjelp' },
        { id: 'b', text: 'som kan jobbe alene' },
      ],
    },
    {
      id: '2',
      question: 'oversiktlig',
      options: [
        { id: 'a', text: 'rotete' },
        { id: 'b', text: 'lett å få oversikt over' },
      ],
    },
  ],
};

function renderBody(props: Partial<React.ComponentProps<typeof McqGroupBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <McqGroupBody
        content={tableContent}
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

const group = (n: number) => screen.getByRole('radiogroup', { name: `Answers for question ${n}` });

describe('McqGroupBody', () => {
  it('gives every question its own radio group over the shared options', () => {
    renderBody();

    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    expect(
      within(group(1))
        .getAllByRole('radio')
        .map((b) => b.textContent),
    ).toEqual(['Riktig', 'Galt']);
  });

  it('lets a question bring its own options', () => {
    renderBody({ content: stackedContent });

    expect(
      within(group(2))
        .getAllByRole('radio')
        .map((b) => b.textContent),
    ).toEqual(['rotete', 'lett å få oversikt over']);
  });

  it('records a pick against its own question and leaves the others alone', () => {
    const onValueChange = vi.fn();
    renderBody({ value: { '1': 'r' }, onValueChange });

    fireEvent.click(within(group(2)).getByRole('radio', { name: 'Galt' }));

    expect(onValueChange).toHaveBeenCalledWith({ '1': 'r', '2': 'g' });
  });

  it('replaces the pick instead of adding to it — one answer per question', () => {
    const onValueChange = vi.fn();
    renderBody({ value: { '1': 'r' }, onValueChange });

    fireEvent.click(within(group(1)).getByRole('radio', { name: 'Galt' }));

    expect(onValueChange).toHaveBeenCalledWith({ '1': 'g' });
    expect(within(group(1)).getByRole('radio', { name: 'Riktig' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('allows submitting only once every question is answered', () => {
    const onAnswerChange = vi.fn();
    const { rerender } = renderBody({ value: { '1': 'r' }, onAnswerChange });

    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('1 of 2 questions answered')).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <McqGroupBody
          content={tableContent}
          value={{ '1': 'r', '2': 'g' }}
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

  it('holds back the key and the note until the answers are unlocked', () => {
    const feedback = {
      phase: 'feedback' as const,
      ok: false,
      value: { '1': 'r', '2': 'r' },
      results: {
        '1': { correct: true, expected: 'r' },
        '2': { correct: false, expected: 'g', explanation: 'The advert asks for three years.' },
      },
    };
    const { rerender } = renderBody(feedback);

    expect(screen.queryByText('The advert asks for three years.')).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <McqGroupBody
          content={tableContent}
          value={feedback.value}
          onValueChange={vi.fn()}
          onAnswerChange={vi.fn()}
          phase="feedback"
          ok={false}
          revealed
          results={feedback.results}
          mode="practice"
          accent={PRACTICE_ACCENT}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('The advert asks for three years.')).toBeInTheDocument();
    // The options stop responding once the block has been checked.
    expect(within(group(2)).getByRole('radio', { name: 'Galt' })).toBeDisabled();
  });
});

describe('checkMcqGroup', () => {
  const expected = {
    items: [
      { id: '1', correct_option_ids: ['r'] },
      { id: '2', correct_option_ids: ['g'], explanation: 'Three years, not five.' },
      { id: '3', correct_option_ids: ['r'] },
    ],
  };

  it('marks each question separately and counts the block', () => {
    const graded = checkMcqGroup(expected, { '1': 'r', '2': 'r', '3': 'r' });

    expect(graded).toMatchObject({ ok: false, correct: 2, total: 3 });
    expect(graded.results['2']).toEqual({
      correct: false,
      expected: 'g',
      explanation: 'Three years, not five.',
    });
  });

  it('counts an unanswered question as wrong', () => {
    expect(checkMcqGroup(expected, { '1': 'r', '3': 'r' })).toMatchObject({
      ok: false,
      correct: 2,
      total: 3,
    });
  });

  it('reports ok only when every question is right', () => {
    expect(checkMcqGroup(expected, { '1': 'r', '2': 'g', '3': 'r' }).ok).toBe(true);
  });
});

describe('keepCorrectPicks', () => {
  it('keeps the questions answered right and clears the misses', () => {
    expect(
      keepCorrectPicks(
        { '1': 'r', '2': 'r' },
        { '1': { correct: true, expected: 'r' }, '2': { correct: false, expected: 'g' } },
      ),
    ).toEqual({ '1': 'r' });
  });
});
