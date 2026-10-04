import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { tokenize, type StudentProjection } from '@/lib/shared-kernel/highlight-in-text';
import type { HighlightInTextSubmitDetails } from '@/features/student/exercises/types/attempts';

import { HighlightInTextBody, type HighlightInTextBodyProps } from './highlight-in-text-body';
import { passageCells } from './highlight-in-text-marks';
import { MarkableText } from './markable-text';

// I(0) fjor(1) sommer(2) reiste(3) vi(4) til(5) Bodø(6) og(7) vi(8) gikk(9) på(10) tur(11)
// ¶ Det(12) var(13) kaldt(14) men(15) fint(16)
const TEXT = 'I fjor sommer reiste vi til Bodø, og vi gikk på tur.\n\nDet var kaldt, men fint.';
const tokens = tokenize(TEXT);
const at = (w: string) => tokens.find((t) => t.w === w)!;

const PROJECTION: StudentProjection = {
  instruction: 'Les teksten og marker det oppgaven spør om.',
  text: TEXT,
  paragraphs: [
    [0, 52],
    [54, 78],
  ],
  questions: [
    { id: 'q1', prompt: 'Find the verbs in the past tense.', unit: 'word', count: null },
    { id: 'q2', prompt: 'Find the time expression.', unit: 'phrase', count: 1 },
  ],
  settings: { attempts: 2, hints: true, revealKey: true },
};

function details(over: Partial<HighlightInTextSubmitDetails> = {}): HighlightInTextSubmitDetails {
  return {
    questionId: 'q1',
    pct: 25,
    passed: false,
    exact: 1,
    near: 0,
    miss: 2,
    fp: 1,
    total: 3,
    cells: [
      { start: at('reiste').s, end: at('reiste').e, state: 'exact' },
      { start: at('til').s, end: at('til').e, state: 'fp' },
    ],
    missHint: 'Look for -te and -de.',
    fpHint: 'A preposition is not a verb.',
    attempt: 1,
    checksLeft: 1,
    closed: false,
    revealed: false,
    questions: [],
    complete: false,
    attemptPct: 0,
    attemptPassed: false,
    ...over,
  };
}

function renderBody(props: Partial<HighlightInTextBodyProps> = {}) {
  const handlers = {
    onMark: vi.fn(),
    onExtend: vi.fn(),
    onClear: vi.fn(),
    onCheck: vi.fn(),
    onRetry: vi.fn(),
    onReveal: vi.fn(),
    onNext: vi.fn(),
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HighlightInTextBody
        projection={PROJECTION}
        questionIndex={0}
        completed={[false, false]}
        marks={[]}
        verdict={null}
        attempt={1}
        accent="var(--ssz-interactive-primary)"
        layout="phone"
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, handlers };
}

const button = (name: string | RegExp) => screen.queryByRole('button', { name });

describe('HighlightInTextBody — marking', () => {
  it('opens with nothing marked and Check disabled until a mark exists (AC-S1)', () => {
    renderBody();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(17);
    expect(button('Check')).toBeDisabled();
  });

  it('counts the marks on the button and offers Clear', async () => {
    const { handlers } = renderBody({
      marks: [
        { t0: 3, t1: 3 },
        { t0: 9, t1: 9 },
      ],
    });
    expect(button('Check (2)')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'reiste' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button('Clear')!);
    expect(handlers.onClear).toHaveBeenCalled();
  });

  it('passes a press on a word to the solver', async () => {
    const { handlers } = renderBody();
    await userEvent.click(screen.getByRole('button', { name: 'gikk' }));
    expect(handlers.onMark).toHaveBeenCalledWith(9, 9);
  });

  it('labels the passage by the prompt, and says how to mark it', () => {
    renderBody();
    expect(
      screen.getByRole('group', { name: 'Find the verbs in the past tense.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tap the words.')).toBeInTheDocument();
  });

  it('never states the expected number without a count (AC-S10), and states it with one', () => {
    renderBody();
    expect(screen.queryByText(/There are/)).toBeNull();
    expect(screen.queryByText(/marked of/)).toBeNull();

    renderBody({ questionIndex: 1 });
    expect(screen.getByText(/There are 1 to find\./)).toBeInTheDocument();
  });

  it('shows no legend and no verdict before a check (BEHAVIOR §6)', () => {
    renderBody({ marks: [{ t0: 3, t1: 3 }] });
    expect(screen.queryByText('right')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('draws the progress rail only for more than one question, with the done ones marked (AC-S12)', () => {
    const { container } = renderBody({ questionIndex: 1, completed: [true, false] });
    const steps = container.querySelectorAll('i[data-s]');
    expect([...steps].map((s) => s.getAttribute('data-s'))).toEqual(['done', 'now']);
    expect(screen.getByText('Question 2 of 2, 1 done')).toBeInTheDocument();
  });
});

describe('HighlightInTextBody — after a check', () => {
  it('draws right green and bold, extra struck through, and freezes the passage (AC-S4)', () => {
    const { container } = renderBody({
      marks: [
        { t0: 3, t1: 3 },
        { t0: 5, t1: 5 },
      ],
      verdict: details(),
    });
    expect(container.querySelector('[data-i="3"]')).toHaveAttribute('data-m', 'ok');
    expect(container.querySelector('[data-i="5"]')).toHaveAttribute('data-m', 'fp');
    expect(screen.queryByRole('button', { name: 'reiste' })).toBeNull();
  });

  it('states found / expected, the extras and the score after the deduction', () => {
    renderBody({ verdict: details() });
    expect(screen.getByText('1 of 3 right · 1 too many')).toBeInTheDocument();
    expect(screen.getByText('— 25% after the deduction.')).toBeInTheDocument();
  });

  it('says nothing about a deduction when none was made', () => {
    renderBody({ verdict: details({ fp: 0, pct: 33, cells: [details().cells[0]!] }) });
    expect(screen.getByText('1 of 3 right', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText('— 33%.')).toBeInTheDocument();
  });

  it('announces the counts before any hint (AC-X8)', () => {
    renderBody({ verdict: details() });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('1 of 3 right, 1 marked too much');
    expect(status).not.toHaveTextContent('Look for');
    const hint = screen.getByText('Look for -te and -de.');
    expect(status.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the hints that came, and the legend with the verdict', () => {
    renderBody({ verdict: details() });
    expect(screen.getByText('A preposition is not a verb.')).toBeInTheDocument();
    expect(screen.getByText('not found')).toBeInTheDocument();
  });

  it('gives a near miss its own line and draws the key boundary', () => {
    const { container } = renderBody({
      questionIndex: 1,
      verdict: details({
        questionId: 'q2',
        exact: 0,
        near: 1,
        fp: 0,
        total: 1,
        pct: 0,
        cells: [
          {
            start: at('sommer').s,
            end: at('sommer').e,
            state: 'near',
            keyStart: 0,
            keyEnd: at('sommer').e,
          },
        ],
      }),
    });
    expect(screen.getByText(/1 mark was a partial hit\./)).toBeInTheDocument();
    expect(container.querySelector('[data-i="0"]')).toHaveAttribute('data-m', 'miss');
    expect(container.querySelector('[data-i="2"]')).toHaveAttribute('data-m', 'near');
    expect(container.querySelector('[data-i="2"]')).toHaveAttribute('data-keyline');
  });

  it('offers a retry and a reveal after a failed check, and the attempt line', async () => {
    const { handlers } = renderBody({ verdict: details() });
    await userEvent.click(button('Try again')!);
    await userEvent.click(button('Show the answer')!);
    expect(handlers.onRetry).toHaveBeenCalled();
    expect(handlers.onReveal).toHaveBeenCalled();
    expect(screen.getByText('Attempt 1 of 2')).toBeInTheDocument();
    expect(button('Next question')).toBeNull();
  });

  it('offers no retry once the question is out of checks, and moves on instead (AC-S7)', () => {
    renderBody({
      projection: { ...PROJECTION, settings: { attempts: 1, hints: true, revealKey: true } },
      verdict: details({ checksLeft: 0, closed: true }),
    });
    expect(button('Try again')).toBeNull();
    expect(button('Show the answer')).not.toBeNull();
    expect(button('Next question')).not.toBeNull();
  });

  it('has no reveal action in any state when the author turned it off (AC-S8)', () => {
    const projection = {
      ...PROJECTION,
      settings: { attempts: 2 as const, hints: true, revealKey: false },
    };
    renderBody({ projection });
    expect(button('Show the answer')).toBeNull();
    renderBody({ projection, verdict: details() });
    expect(button('Show the answer')).toBeNull();
    renderBody({ projection, verdict: details({ closed: true, checksLeft: 0 }) });
    expect(button('Show the answer')).toBeNull();
  });

  it('moves on after a pass, and offers nothing after the last question (deviation 12)', () => {
    const passed = details({ passed: true, closed: true, pct: 100, exact: 3, fp: 0, cells: [] });
    renderBody({ verdict: passed });
    expect(button('Next question')).not.toBeNull();
    expect(button('Try again')).toBeNull();

    renderBody({ questionIndex: 1, verdict: { ...passed, questionId: 'q2' } });
    expect(screen.getAllByRole('button', { name: 'Next question' })).toHaveLength(1);
  });
});

describe('HighlightInTextBody — reveal (AC-S9)', () => {
  it('draws every key span with its ordinal and lists the reasons', () => {
    const { container } = renderBody({
      verdict: details({
        revealed: true,
        closed: true,
        cells: [],
        key: [
          { n: 1, start: at('reiste').s, end: at('reiste').e, why: 'reise → reiste' },
          { n: 2, start: at('gikk').s, end: at('gikk').e, why: 'gå → gikk' },
          { n: 3, start: at('var').s, end: at('var').e },
        ],
      }),
    });
    expect(container.querySelector('[data-i="3"]')).toHaveAttribute('data-m', 'key');
    expect(container.querySelector('[data-i="13"]')).toHaveAttribute('data-m', 'key');
    expect(container.querySelector('[data-i="9"] [aria-hidden="true"]')?.textContent).toBe('2');
    expect(screen.getByText('2. gikk')).toBeInTheDocument();
    expect(screen.getByText(/gå → gikk/)).toBeInTheDocument();
    expect(screen.getByText('answer')).toBeInTheDocument();
    expect(button('Try again')).toBeNull();
    expect(button('Show the answer')).toBeNull();
  });
});

describe('HighlightInTextBody — layouts', () => {
  it('puts the prompt, counter and actions in a side column on desktop', () => {
    const { container } = renderBody({ layout: 'desktop', title: 'Sommer' });
    expect(container.querySelector('[data-layout="desktop"]')).not.toBeNull();
    expect(screen.getByText('Sommer')).toBeInTheDocument();
  });

  it('shows an empty state when no question is ready', () => {
    renderBody({ projection: { ...PROJECTION, questions: [] } });
    expect(screen.getByText('Nothing to mark yet')).toBeInTheDocument();
  });

  it.each(['phone', 'desktop'] as const)(
    'has no axe violations on the %s layout (AC-X6)',
    async (layout) => {
      const { container } = renderBody({ layout, marks: [{ t0: 3, t1: 3 }] });
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations).toEqual([]);

      const checked = renderBody({ layout, verdict: details() });
      const after = await axe.run(checked.container, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(after.violations).toEqual([]);
    },
  );
});

/**
 * AC-X10 — one renderer. The runner's passage and a bare `MarkableText` fed the same cells
 * (what the builder canvas and the preview will do) produce the same token markup.
 */
describe('HighlightInTextBody — one renderer (AC-X10)', () => {
  it('renders the passage through MarkableText, token for token', () => {
    const marks = [
      { t0: 0, t1: 2 },
      { t0: 9, t1: 9 },
    ];
    const { container } = renderBody({ marks, layout: 'desktop' });
    const inBody = container.querySelector('[data-markable-text]')!;

    const { cells } = passageCells(marks, null, tokens);
    const bare = render(
      <MarkableText
        text={TEXT}
        live
        unit="word"
        cellOf={(i) => cells.get(i) ?? null}
        labelledBy="x"
      />,
    );
    const alone = bare.container.querySelector('[data-markable-text]')!;

    const markup = (el: Element) =>
      [...el.querySelectorAll('[data-i]')].map((t) => t.outerHTML).join('');
    expect(markup(inBody)).toBe(markup(alone));
    expect(within(inBody as HTMLElement).getAllByRole('button')).toHaveLength(17);
  });
});
