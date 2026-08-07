import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import { FeedbackMatrix } from './feedback-matrix';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: 'På kafé',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [
      { id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] },
      { id: 's2', text: 'Kan jeg få regningen, takk?', gaps: [3] },
    ],
    distractors: ['bestilt'],
    feedback: {
      's1#3': { fallback: 'Her mangler verbet.', why: '', pairs: {} },
      's2#3': { fallback: 'Feil ord.', why: '', pairs: {} },
    },
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

/** Exposes the document so a test can assert on what was stored, not only on the DOM. */
function Harness({
  initial,
  onDocument,
}: {
  initial: WordBankGapFill;
  onDocument?: (next: WordBankGapFill) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FeedbackMatrix
        exercise={exercise}
        onChange={(next) => {
          onDocument?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderMatrix(initial: WordBankGapFill) {
  let latest = initial;
  const view = render(
    <Harness
      initial={initial}
      onDocument={(next) => {
        latest = next;
      }}
    />,
  );
  return { ...view, user: userEvent.setup(), document: () => latest };
}

describe('FeedbackMatrix', () => {
  it('lays gaps against every bank word, own answer excluded from writing (AC-B19)', () => {
    renderMatrix(doc());

    const row = screen.getByRole('row', { name: /G1/ });
    expect(within(row).getByText('bestille is the correct answer for G1')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Write an explanation for G1 × regningen' }),
    ).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /G1 × bestille/ })).not.toBeInTheDocument();
  });

  it('opens the editor on a cell and stores the text as the author’s (AC-B20)', async () => {
    const { user, document } = renderMatrix(doc());

    await user.click(screen.getByRole('button', { name: 'Write an explanation for G1 × bestilt' }));

    const field = screen.getByRole('textbox', {
      name: 'Edit the explanation for G1 × bestilt',
    });
    expect(field).toHaveFocus();
    expect(screen.getByText('G1 × bestilt')).toBeInTheDocument();

    await user.type(field, 'Perfektum passer ikke her.');

    expect(document().feedback['s1#3']?.pairs.bestilt).toEqual({
      text: 'Perfektum passer ikke her.',
      origin: 'author',
    });
  });

  it('walks the pairs with the arrows and with Ctrl+Enter (AC-B20)', async () => {
    const { user } = renderMatrix(doc());

    // Pairs are walked in document order: the bank lists answers first, then
    // distractors, and each gap skips its own answer.
    await user.click(
      screen.getByRole('button', { name: 'Write an explanation for G1 × regningen' }),
    );
    expect(screen.getByText('1 of 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next pair' }));
    expect(screen.getByText('G1 × bestilt')).toBeInTheDocument();

    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(screen.getByText('G2 × bestille')).toBeInTheDocument();
    expect(screen.getByText('3 of 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous pair' }));
    expect(screen.getByText('G1 × bestilt')).toBeInTheDocument();
  });

  it('shows the gap default as the placeholder of an empty cell (AC-B21)', async () => {
    const { user } = renderMatrix(doc());

    await user.click(screen.getByRole('button', { name: 'Write an explanation for G1 × bestilt' }));

    expect(
      screen.getByRole('textbox', { name: 'Edit the explanation for G1 × bestilt' }),
    ).toHaveAttribute('placeholder', 'Falls back to: Her mangler verbet.');
  });

  it('marks a written cell and offers to edit it', () => {
    renderMatrix(
      doc({
        feedback: {
          's1#3': {
            fallback: 'Her mangler verbet.',
            why: '',
            pairs: { bestilt: { text: 'Perfektum passer ikke.', origin: 'author' } },
          },
        },
      }),
    );

    expect(
      screen.getByRole('button', { name: 'Edit the explanation for G1 × bestilt' }),
    ).toBeInTheDocument();
  });

  it('keeps its own horizontal scroll, whatever the bank size', () => {
    const { container } = renderMatrix(
      doc({
        distractors: Array.from({ length: 10 }, (_, index) => `ord${index}`),
        sentences: Array.from({ length: 6 }, (_, index) => ({
          id: `s${index}`,
          text: `Setning nummer ${index} her.`,
          gaps: [2],
        })),
      }),
    );

    const table = container.querySelector('table')!;
    expect(table.parentElement).toHaveClass('overflow-x-auto');
    // 6 gaps, 6 distinct answers + 10 distractors: the grid is real, not a stub.
    expect(screen.getAllByRole('columnheader')).toHaveLength(17);
  });

  it('has no serious or critical accessibility violations (AC-X2)', async () => {
    const { container, user } = renderMatrix(doc());
    await user.click(screen.getByRole('button', { name: 'Write an explanation for G1 × bestilt' }));

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
