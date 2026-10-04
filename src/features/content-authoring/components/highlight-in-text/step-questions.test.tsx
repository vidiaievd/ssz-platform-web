import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  emptyContent,
  HT_MAX_Q,
  newQuestion,
  tokenize,
  type HighlightInTextContent,
} from '@/lib/shared-kernel/highlight-in-text';
import {
  exercise,
  question,
  SAMPLE_TEXT,
  spanAt,
} from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import { MarkableText } from '@/features/student/exercises/runner/markable-text';

import { StepQuestions } from './step-questions';

function Harness({
  initial,
  spy,
  onGoStep,
}: {
  initial: HighlightInTextContent;
  spy: (ex: HighlightInTextContent) => void;
  onGoStep: (step: 1 | 2 | 3 | 4) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepQuestions
      exercise={ex}
      onGoStep={onGoStep}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: HighlightInTextContent) {
  const spy = vi.fn();
  const onGoStep = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} onGoStep={onGoStep} />
    </NextIntlClientProvider>,
  );
  return {
    ...view,
    spy,
    onGoStep,
    last: () => spy.mock.calls.at(-1)?.[0] as HighlightInTextContent,
  };
}

const tokens = tokenize(SAMPLE_TEXT);
const indexOf = (word: string, nth = 1) => tokens.filter((t) => t.w === word)[nth - 1]!.i;
const canvas = () => screen.getByRole('group', { name: 'Mark the answers' });
const tokenEl = (i: number) => canvas().querySelector<HTMLElement>(`[data-i="${i}"]`)!;
const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('StepQuestions — tabs and fields', () => {
  it('outlines a question without wording in red (AC-A2)', () => {
    draw(exercise({ questions: [...exercise().questions, question('q3', { prompt: '' })] }));
    const bad = screen.getAllByRole('tab').at(-1)!;
    expect(bad).toHaveAttribute('data-bad');
    expect(bad).toHaveTextContent('New question');
    expect(tab(/Marker alle verbene/)).not.toHaveAttribute('data-bad');
  });

  it('adds a question and opens it, until four — then says so instead (AC-A3)', async () => {
    const { last } = draw(exercise());
    await userEvent.click(screen.getByRole('button', { name: 'Question' }));
    expect(last().questions).toHaveLength(3);
    expect(screen.getAllByRole('tab').at(-1)).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Question' }));
    expect(screen.queryByRole('button', { name: 'Question' })).toBeNull();
    expect(screen.getByText(`${HT_MAX_Q} is the ceiling`)).toBeInTheDocument();
  });

  it('writes the prompt and switches the unit without cutting a phrase mark, with a warning', async () => {
    const { last } = draw(exercise());
    await userEvent.click(tab(/Marker tidsuttrykkene/));
    await userEvent.click(screen.getByRole('radio', { name: 'Single words' }));
    expect(last().questions[1]!.unit).toBe('word');
    expect(last().questions[1]!.spans).toEqual(exercise().questions[1]!.spans);
    expect(screen.getByText('This question already contains a phrase mark.')).toBeInTheDocument();
  });
});

describe('StepQuestions — the canvas', () => {
  it('marks a word on click and removes it on a second click', async () => {
    const { last } = draw(exercise({ questions: [question('q1')] }));
    await userEvent.click(within(canvas()).getByRole('button', { name: 'reiste' }));
    expect(last().questions[0]!.spans).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: /Why mark 1 «reiste» counts/ })).toBeInTheDocument();

    await userEvent.click(within(canvas()).getByRole('button', { name: 'reiste' }));
    expect(last().questions[0]!.spans).toHaveLength(0);
    expect(screen.getByText('Nothing marked yet')).toBeInTheDocument();
  });

  it('a drag in a word question marks only where it started (AC-M3)', () => {
    const { last } = draw(exercise({ questions: [question('q1')] }));
    const from = indexOf('reiste');
    fireEvent.pointerDown(tokenEl(from), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(tokenEl(from + 2));
    fireEvent.pointerUp(window);
    const [span] = last().questions[0]!.spans;
    expect(SAMPLE_TEXT.slice(span!.start, span!.end)).toBe('reiste');
  });

  it('a drag in a phrase question marks the run', () => {
    const { last } = draw(exercise({ questions: [question('q1', { unit: 'phrase' })] }));
    fireEvent.pointerDown(tokenEl(0), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(tokenEl(2));
    fireEvent.pointerUp(window);
    const [span] = last().questions[0]!.spans;
    expect(SAMPLE_TEXT.slice(span!.start, span!.end)).toBe('I fjor sommer');
  });

  it('flags two marks over the same words (AC-M4)', () => {
    const overlapping = question('q1', {
      unit: 'phrase',
      spans: [spanAt(SAMPLE_TEXT, 'I fjor sommer', 1, 'a'), spanAt(SAMPLE_TEXT, 'sommer', 1, 'b')],
    });
    draw(exercise({ questions: [overlapping] }));
    expect(screen.getByText('Two marks overlap')).toBeInTheDocument();
  });

  it('numbers the marks in text order, in the canvas and in the key', () => {
    draw(exercise());
    const first = tokenEl(indexOf('reiste'));
    expect(first.querySelector('[aria-hidden="true"]')?.textContent).toBe('1');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(/^1reiste/);
  });

  it('clears every mark of the question', async () => {
    const { last } = draw(exercise());
    await userEvent.click(screen.getByRole('button', { name: 'Clear marks' }));
    expect(last().questions[0]!.spans).toEqual([]);
    expect(last().questions[1]!.spans).toHaveLength(6);
  });
});

describe('StepQuestions — the key list', () => {
  it('links a row and its mark both ways on hover (AC-A7)', () => {
    draw(exercise());
    const row = screen.getAllByRole('listitem')[2]!; // «gikk», the third in text order
    fireEvent.pointerEnter(row);
    expect(tokenEl(indexOf('gikk'))).toHaveAttribute('data-hot');
    fireEvent.pointerLeave(row);
    expect(tokenEl(indexOf('gikk'))).not.toHaveAttribute('data-hot');

    fireEvent.pointerEnter(tokenEl(indexOf('tok')));
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('data-hot');
  });

  it('writes a reason and removes a mark from its row', async () => {
    const { last } = draw(
      exercise({ questions: [question('q1', { spans: [spanAt(SAMPLE_TEXT, 'reiste')] })] }),
    );
    await userEvent.type(screen.getByRole('textbox', { name: /Why mark 1/ }), 'reise → reiste');
    expect(last().questions[0]!.spans[0]!.why).toBe('reise → reiste');
    await userEvent.click(screen.getByRole('button', { name: 'Remove mark 1 «reiste»' }));
    expect(last().questions[0]!.spans).toEqual([]);
  });
});

describe('StepQuestions — density', () => {
  it('turns a question past 40% amber (AC-A4)', () => {
    const many = tokens
      .slice(0, Math.ceil(tokens.length * 0.45))
      .map((t) => ({ id: `s${t.i}`, start: t.s, end: t.e, why: '' }));
    draw(exercise({ questions: [question('q1', { spans: many }), exercise().questions[1]!] }));
    const [first, second] = screen.getAllByRole('meter');
    expect(first).toHaveAttribute('data-skew');
    expect(second).not.toHaveAttribute('data-skew');
    expect(
      screen.getByText(`${Math.round((many.length / tokens.length) * 100)}%`),
    ).toBeInTheDocument();
  });
});

describe('StepQuestions — deleting a question', () => {
  it('deletes it with its marks and its orphans, and is offered only past one question (AC-A6)', async () => {
    const withOrphan = exercise({
      orphans: [{ id: 'o1', qid: 'q2', surface: 'hele uka', why: '' }],
    });
    const { last } = draw(withOrphan);
    await userEvent.click(tab(/Marker tidsuttrykkene/));
    await userEvent.click(
      screen.getByRole('button', { name: /Delete “Marker tidsuttrykkene\.” and its 6 marks/ }),
    );
    expect(last().questions.map((q) => q.id)).toEqual(['q1']);
    expect(last().orphans).toEqual([]);
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });
});

describe('StepQuestions — orphans', () => {
  it('puts an orphan back where its words still are, with its reason (AC-R4)', async () => {
    const q1 = question('q1', { spans: [] });
    const { last } = draw(
      exercise({
        questions: [q1],
        orphans: [{ id: 'o1', qid: 'q1', surface: 'reiste', why: 'reise' }],
      }),
    );
    expect(screen.getByText('1 mark lost its place when the text changed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(last().orphans).toEqual([]);
    expect(last().questions[0]!.spans).toEqual([
      { ...spanAt(SAMPLE_TEXT, 'reiste', 1, 'o1'), why: 'reise' },
    ]);
  });

  it('offers only dropping when the words are gone', async () => {
    const { last } = draw(
      exercise({ orphans: [{ id: 'o1', qid: 'q1', surface: 'fløy', why: '' }] }),
    );
    expect(screen.getByText('those words are gone')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Put it back' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Drop the mark «fløy»' }));
    expect(last().orphans).toEqual([]);
  });
});

describe('StepQuestions — no text', () => {
  it('sends the author back to the text', async () => {
    const { onGoStep } = draw(emptyContent());
    expect(screen.getByText('No text to mark in')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to the text' }));
    expect(onGoStep).toHaveBeenCalledWith(1);
  });
});

describe('StepQuestions — accessibility (AC-X6)', () => {
  it('has no axe violations with marks, orphans and an incomplete question', async () => {
    const { container } = draw(
      exercise({
        questions: [...exercise().questions, { ...newQuestion(), id: 'q3' }],
        orphans: [{ id: 'o1', qid: 'q1', surface: 'reiste', why: '' }],
      }),
    );
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('can mark and extend a phrase by keyboard alone (AC-X7)', async () => {
    const { last } = draw(exercise({ questions: [question('q1', { unit: 'phrase' })] }));
    tokenEl(0).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
    const [span] = last().questions[0]!.spans;
    expect(SAMPLE_TEXT.slice(span!.start, span!.end)).toBe('I fjor sommer');
  });
});

/**
 * AC-X10 — the builder canvas is the student's renderer: the same marks drawn by a bare
 * `MarkableText` give the same token markup, token for token.
 */
describe('StepQuestions — one renderer (AC-X10)', () => {
  it('draws the canvas through MarkableText', () => {
    const q1 = question('q1', {
      spans: [spanAt(SAMPLE_TEXT, 'reiste', 1, 'a'), spanAt(SAMPLE_TEXT, 'gikk', 1, 'b')],
    });
    draw(exercise({ questions: [q1] }));
    const inStep = canvas();

    const at = (w: string) => indexOf(w);
    const bare = render(
      <MarkableText
        text={SAMPLE_TEXT}
        live
        unit="word"
        cellOf={(i) =>
          i === at('reiste') ? { m: 'key', k: 'a' } : i === at('gikk') ? { m: 'key', k: 'b' } : null
        }
        numbers={(i) => (i === at('reiste') ? 1 : i === at('gikk') ? 2 : null)}
      />,
    );
    const markup = (el: Element) =>
      [...el.querySelectorAll('[data-i]')].map((t) => t.outerHTML).join('');
    expect(markup(inStep)).toBe(markup(bare.container));
  });
});
