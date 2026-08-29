import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceContent } from '@/lib/shared-kernel/multiple-choice';
import { content, option, question } from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import { StepDistractors } from './step-distractors';
import type { MultipleChoiceDocument } from './edits';

function doc(overrides: Partial<MultipleChoiceContent> = {}): MultipleChoiceDocument {
  return { updatedAt: '2026-08-28T10:00:00.000Z', ...content(overrides) };
}

function Harness({ initial, language }: { initial: MultipleChoiceDocument; language?: string }) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepDistractors exercise={exercise} onChange={setExercise} language={language} />
    </NextIntlClientProvider>
  );
}

/** The coverage strip's number, which the markup splits across two elements. */
function coverageReads(): string {
  return (document.querySelector('section p')?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function renderStep(initial: MultipleChoiceDocument = doc(), language = 'nb') {
  render(<Harness initial={initial} language={language} />);
  return userEvent.setup();
}

/** Two options and nothing else wrong — the shape of every riktig/galt question we seed. */
const coinFlip = () =>
  doc({
    questions: [
      question({
        options: [option({ id: 'a', text: 'Riktig', correct: true }), option({ id: 'b', text: 'Galt' })],
      }),
    ],
  });

describe('StepDistractors', () => {
  it('calls a question with nothing to flag clean', () => {
    renderStep();

    expect(screen.getByText('clean')).toBeInTheDocument();
    expect(coverageReads()).toBe('1 / 1');
  });

  it('flags two options as a coin flip and counts the question as unclean', () => {
    renderStep(coinFlip());

    // Q6: the warning is right and is not silenced. A riktig/galt lesson honestly reads
    // "0 / 1 clean", and that is the state of the content rather than a fault in the step.
    expect(screen.getByText(/Two options is a coin flip/)).toBeInTheDocument();
    expect(coverageReads()).toBe('0 / 1');
    expect(screen.getByText('1 note')).toBeInTheDocument();
  });

  it('puts an option-level flag under the option it names', () => {
    renderStep(
      doc({
        questions: [
          question({
            options: [
              option({ id: 'a', text: 'var', correct: true }),
              option({ id: 'b', text: 'var' }),
              option({ id: 'c', text: 'har vært' }),
            ],
          }),
        ],
      }),
    );

    // The second occurrence is the one flagged, so the message lands on the row the author
    // most likely meant to change.
    const secondRow = screen
      .getByRole('textbox', { name: 'Option B of question 1' })
      .closest('li');
    expect(secondRow).toHaveTextContent('Two options say the same thing.');
  });

  it('stays silent about absolutes when the course language has no pack', () => {
    const withAbsolute = doc({
      questions: [
        question({
          options: [
            option({ id: 'a', text: 'var', correct: true }),
            option({ id: 'b', text: 'alltid var' }),
            option({ id: 'c', text: 'har vært' }),
          ],
        }),
      ],
    });

    const { rerender } = render(<Harness initial={withAbsolute} language="nb" />);
    expect(screen.getByText(/uses an absolute/)).toBeInTheDocument();

    rerender(<Harness initial={withAbsolute} language="ja" />);
    expect(screen.queryByText(/uses an absolute/)).toBeNull();
  });

  it('edits an option in place and recomputes the flags on the keystroke', async () => {
    const user = renderStep(coinFlip());

    expect(coverageReads()).toBe('0 / 1');

    // Nothing is added on this step; the audit has to follow the typing.
    await user.clear(screen.getByRole('textbox', { name: 'Option B of question 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Option B of question 1' }), 'Riktig');

    expect(screen.getByText('Two options say the same thing. Rewrite one of them.')).toBeInTheDocument();
  });

  it('pins an option to the bottom of the list', async () => {
    const user = renderStep();

    const pin = screen.getAllByRole('switch', { name: 'pin last' })[2]!;
    await user.click(pin);

    expect(pin).toBeChecked();
  });
});
