import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import { StepWordBank } from './step-word-bank';

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
    distractors: [],
    feedback: {},
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

function Harness({ initial, suggestions }: { initial: WordBankGapFill; suggestions?: string[] }) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepWordBank
        exercise={exercise}
        onChange={setExercise}
        {...(suggestions === undefined ? {} : { suggestions })}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: WordBankGapFill, suggestions?: string[]) {
  const view = render(
    <Harness initial={initial} {...(suggestions === undefined ? {} : { suggestions })} />,
  );
  return { ...view, user: userEvent.setup() };
}

describe('StepWordBank', () => {
  it('shows the derived answers as locked chips with their gap labels (AC-B8)', () => {
    renderStep(doc());

    const answers = screen.getByText('Correct answers').closest('section')!;
    expect(answers).toHaveTextContent('bestilleG1');
    expect(answers).toHaveTextContent('regningenG2');
    // Nothing in the section is editable — answers change in step 1.
    expect(answers.querySelectorAll('input')).toHaveLength(0);
  });

  it('refuses a distractor that is already an answer (AC-B9)', async () => {
    const { user } = renderStep(doc());

    await user.type(screen.getByRole('textbox', { name: 'Wrong words' }), 'bestille');

    expect(screen.getByRole('alert')).toHaveTextContent('“bestille” is already a correct answer.');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('adds several comma-separated distractors at once (AC-B10)', async () => {
    const { user } = renderStep(doc());

    await user.type(
      screen.getByRole('textbox', { name: 'Wrong words' }),
      'bestilt, bestilling{Enter}',
    );

    expect(screen.getByRole('button', { name: 'Remove bestilt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove bestilling' })).toBeInTheDocument();
  });

  it('takes a removed distractor’s pair explanations with it (AC-B11)', async () => {
    const { user } = renderStep(
      doc({
        distractors: ['bestilt'],
        feedback: {
          's1#3': {
            fallback: 'Verbet mangler.',
            why: '',
            pairs: { bestilt: { text: 'Perfektum passer ikke.', origin: 'author' } },
          },
        },
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Remove bestilt' }));

    expect(screen.queryByRole('button', { name: 'Remove bestilt' })).not.toBeInTheDocument();
    // The bank is back to two words for two gaps, so the elimination warning returns.
    expect(screen.getByText(/solve themselves by elimination/)).toBeInTheDocument();
  });

  it('adds a glossary suggestion and drops it from the list (AC-B12)', async () => {
    const { user } = renderStep(doc(), ['kaffe', 'bestille']);

    // Already an answer, so it is never offered.
    expect(screen.queryByRole('button', { name: /bestille/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'kaffe' }));

    expect(screen.getByRole('button', { name: 'Remove kaffe' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'kaffe' })).not.toBeInTheDocument();
  });

  it('warns when one word answers two gaps and reuse is off (AC-B13)', () => {
    renderStep(
      doc({
        sentences: [
          { id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] },
          { id: 's2', text: 'Kan jeg bestille en til?', gaps: [2] },
        ],
      }),
    );

    expect(screen.getByText(/bestille answers more than one gap/)).toBeInTheDocument();
  });

  it('turns the bank callout amber below gaps + 2 (AC-B14)', async () => {
    const { user } = renderStep(doc());

    expect(screen.getByText(/solve themselves by elimination/)).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'Wrong words' }),
      'bestilt, bestilling{Enter}',
    );

    expect(screen.queryByText(/solve themselves by elimination/)).not.toBeInTheDocument();
    expect(screen.getByText(/still a choice/)).toBeInTheDocument();
  });

  it('hides the bank in free mode and offers alternatives per gap', async () => {
    const { user } = renderStep(
      doc({
        distractors: ['bestilt'],
        feedback: {
          's1#3': {
            fallback: 'Verbet mangler.',
            why: '',
            pairs: { bestilt: { text: 'Perfektum passer ikke.', origin: 'author' } },
          },
        },
      }),
    );

    await user.click(screen.getByRole('radio', { name: 'Type the word' }));

    expect(screen.queryByRole('textbox', { name: 'Wrong words' })).not.toBeInTheDocument();
    expect(screen.getByText(/will not be shown/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('G1 — bestille'), 'å bestille');

    // Back to the bank, and the distractor the teacher kept is still there.
    await user.click(screen.getByRole('radio', { name: 'Pick from a bank' }));
    expect(screen.getByRole('button', { name: 'Remove bestilt' })).toBeInTheDocument();
  });

  it('has no serious or critical accessibility violations (AC-X2)', async () => {
    const { container } = renderStep(doc({ distractors: ['bestilt'] }), ['kaffe']);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
