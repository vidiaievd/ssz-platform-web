import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import { StepSentences } from './step-sentences';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: 'På kafé',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [] }],
    distractors: [],
    feedback: {},
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

/** Drives the controlled component the way the shell will, so edits accumulate. */
function Harness({ initial, onChange }: { initial: WordBankGapFill; onChange?: () => void }) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepSentences
        exercise={exercise}
        onChange={(next) => {
          onChange?.();
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const renderStep = (initial: WordBankGapFill) => {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup(), onChange };
};

describe('StepSentences', () => {
  it('turns a clicked token into a labelled gap (AC-B1)', async () => {
    const { user } = renderStep(doc());

    await user.click(screen.getByRole('button', { name: 'bestille' }));

    const chip = screen.getByRole('button', { name: /bestille/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(within(chip).getByText('G1')).toBeInTheDocument();
    expect(screen.getByText('1 gap · G1')).toBeInTheDocument();
  });

  it('un-gapping the last gap raises the no-gap error (AC-B2)', async () => {
    const { user } = renderStep(
      doc({ sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }] }),
    );

    await user.click(screen.getByRole('button', { name: /bestille/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Mark at least one word as a gap.');
  });

  it('strips brackets on input and gaps that word (AC-B3)', async () => {
    const { user } = renderStep(doc({ sentences: [{ id: 's1', text: '', gaps: [] }] }));

    const input = screen.getByRole('textbox', { name: 'Sentence 1' });
    // `[` opens a key descriptor in user-event, so a literal one is doubled.
    await user.type(input, 'Kan jeg få [[regningen], takk?');

    expect(input).toHaveValue('Kan jeg få regningen, takk?');
    expect(screen.getByRole('button', { name: /regningen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('adds a sentence per pasted line with its gaps marked (AC-B4)', async () => {
    const { user } = renderStep(doc({ sentences: [] }));

    await user.click(screen.getByRole('button', { name: 'Paste several' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Paste several sentences' }),
      'Jeg vil gjerne [[bestille] en kaffe.{Enter}Kan jeg få [[regningen], takk?',
    );
    await user.click(screen.getByRole('button', { name: 'Add 2 sentences' }));

    expect(screen.getByRole('textbox', { name: 'Sentence 1' })).toHaveValue(
      'Jeg vil gjerne bestille en kaffe.',
    );
    expect(screen.getByRole('textbox', { name: 'Sentence 2' })).toHaveValue(
      'Kan jeg få regningen, takk?',
    );
    expect(screen.getAllByText('1 gap · G1')).toHaveLength(1);
    expect(screen.getByText('1 gap · G2')).toBeInTheDocument();
  });

  it('focuses the new input after Add sentence (AC-B6)', async () => {
    const { user } = renderStep(doc({ sentences: [] }));

    await user.click(screen.getByRole('button', { name: 'Add sentence' }));

    expect(screen.getByRole('textbox', { name: 'Sentence 1' })).toHaveFocus();
  });

  it('moves focus to the card that took the deleted one’s place', async () => {
    const { user } = renderStep(
      doc({
        sentences: [
          { id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] },
          { id: 's2', text: 'Kan jeg få regningen, takk?', gaps: [3] },
        ],
      }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Delete sentence' })[0]!);

    const remaining = screen.getByRole('textbox', { name: 'Sentence 1' });
    expect(remaining).toHaveValue('Kan jeg få regningen, takk?');
    expect(remaining).toHaveFocus();
  });

  it('renumbers labels when a sentence moves (AC-B7)', async () => {
    const { user } = renderStep(
      doc({
        sentences: [
          { id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] },
          { id: 's2', text: 'Kan jeg få regningen, takk?', gaps: [3] },
        ],
      }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Move sentence up' })[1]!);

    expect(screen.getByRole('textbox', { name: 'Sentence 1' })).toHaveValue(
      'Kan jeg få regningen, takk?',
    );
    expect(within(screen.getByRole('button', { name: /regningen/ })).getByText('G1')).toBeVisible();
    expect(within(screen.getByRole('button', { name: /bestille/ })).getByText('G2')).toBeVisible();
  });

  it('warns before an un-gap that would delete explanations', async () => {
    const { user } = renderStep(
      doc({
        sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }],
        feedback: {
          's1#3': { fallback: 'Verbet mangler.', why: 'Infinitiv.', pairs: {} },
        },
      }),
    );

    await user.click(screen.getByRole('button', { name: /bestille/ }));

    expect(
      screen.getByText('2 explanations will be deleted and cannot be recovered.'),
    ).toBeInTheDocument();
    // Still a gap: nothing is lost until the teacher says so. The open dialog
    // hides the page from the accessible tree, hence `hidden`.
    expect(screen.getByRole('button', { name: /bestille/, hidden: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Delete anyway' }));

    expect(screen.getByRole('button', { name: 'bestille' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps a hint on the sentence it belongs to', async () => {
    const { user } = renderStep(
      doc({ sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }] }),
    );

    await user.click(screen.getByRole('button', { name: 'Add a hint' }));
    await user.type(screen.getByLabelText('Hint for students (optional)'), 'Du skal betale nå.');

    expect(screen.getByLabelText('Hint for students (optional)')).toHaveValue('Du skal betale nå.');
  });

  // Colour contrast is off: jsdom has no layout, so axe cannot compute it, and the
  // palette is the shared token set the rest of the product is checked against.
  it('has no serious or critical accessibility violations (AC-X2)', async () => {
    const { container } = render(
      <Harness
        initial={doc({
          sentences: [
            { id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3], hint: 'Betal nå.' },
            { id: 's2', text: 'Kan jeg få regningen, takk?', gaps: [] },
          ],
        })}
      />,
    );

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
