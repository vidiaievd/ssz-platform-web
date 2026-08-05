import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import { StepFeedback } from './step-feedback';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: 'På kafé',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }],
    distractors: ['bestilt', 'bestilling'],
    feedback: {
      's1#3': { fallback: 'Her mangler verbet.', why: '', pairs: {} },
    },
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

function Harness({ initial }: { initial: WordBankGapFill }) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFeedback exercise={exercise} onChange={setExercise} />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: WordBankGapFill) {
  const view = render(<Harness initial={initial} />);
  return { ...view, user: userEvent.setup() };
}

describe('StepFeedback', () => {
  it('shows each gap’s coverage against the bank minus its own answer (AC-B15)', () => {
    renderStep(doc());

    // Bank is bestille + bestilt + bestilling; the gap's own answer does not count.
    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 word pairs written')).toBeInTheDocument();
  });

  it('puts a gap with no default explanation in the error state (AC-B16)', () => {
    renderStep(doc({ feedback: {} }));

    expect(screen.getByLabelText('Default explanation')).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('1 gap still has no default explanation.', { exact: false }),
    ).toBeInTheDocument();
  });

  it('counts a pair explanation as soon as it is written (AC-B17)', async () => {
    const { user } = renderStep(doc());

    await user.type(screen.getByLabelText('bestilt'), 'Perfektum passer ikke her.');

    expect(screen.getByText('1 of 2 word pairs written')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('the filter hides written pair rows but never the two fields (AC-B18)', async () => {
    const { user } = renderStep(
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

    await user.click(screen.getByRole('checkbox', { name: 'Only words without an explanation' }));

    expect(screen.queryByLabelText('bestilt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('bestilling')).toBeInTheDocument();
    expect(screen.getByLabelText('Default explanation')).toBeInTheDocument();
    expect(screen.getByLabelText('Why the answer is right (optional)')).toBeInTheDocument();
  });

  it('offers the default explanation as the placeholder of an empty pair (AC-B21)', () => {
    renderStep(doc());

    expect(screen.getByLabelText('bestilt')).toHaveAttribute(
      'placeholder',
      'Falls back to: Her mangler verbet.',
    );
  });

  it('drops pair text that is cleared rather than storing a blank', async () => {
    const { user } = renderStep(
      doc({
        feedback: {
          's1#3': {
            fallback: 'Her mangler verbet.',
            why: '',
            pairs: { bestilt: { text: 'Nei.', origin: 'author' } },
          },
        },
      }),
    );

    expect(screen.getByText('1 of 2 word pairs written')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('bestilt'));

    expect(screen.getByText('0 of 2 word pairs written')).toBeInTheDocument();
  });

  it('switches between the two views over the same pairs', async () => {
    const { user } = renderStep(doc());

    await user.click(screen.getByRole('radio', { name: 'Matrix' }));

    expect(
      screen.getByRole('button', { name: 'Write an explanation for G1 × bestilt' }),
    ).toBeInTheDocument();
    // The filter belongs to the list; in the matrix an empty cell is the point.
    expect(
      screen.queryByRole('checkbox', { name: 'Only words without an explanation' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'By gap' }));
    expect(screen.getByLabelText('bestilt')).toBeInTheDocument();
  });

  it('hides the pair rows in free-type mode, where nobody chose a word', () => {
    renderStep(doc({ settings: { ...DEFAULT_SETTINGS, input: 'free' } }));

    expect(screen.queryByLabelText('bestilt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Default explanation')).toBeInTheDocument();
  });

  it('marks the gapped word inside the sentence it belongs to', () => {
    renderStep(doc());

    const header = screen.getByText('G1').parentElement!;
    expect(within(header).getByText('bestille')).toHaveClass('font-semibold');
  });

  it('has no serious or critical accessibility violations (AC-X2)', async () => {
    const { container } = renderStep(doc({ feedback: {} }));

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
