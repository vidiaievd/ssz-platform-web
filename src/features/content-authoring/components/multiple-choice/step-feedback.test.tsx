import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE } from '@/lib/shared-kernel/multiple-choice';
import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceContent } from '@/lib/shared-kernel/multiple-choice';
import { content, option, question } from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import { StepFeedback } from './step-feedback';
import type { MultipleChoiceDocument } from './edits';

function doc(overrides: Partial<MultipleChoiceContent> = {}): MultipleChoiceDocument {
  return {
    updatedAt: '2026-08-28T10:00:00.000Z',
    // Every builder document carries the audio layer, and an exercise that has never had
    // any reads as switched off (plan 56 phase 4).
    audio: readAudioDraft({}, TEMPLATE_CODE),
    ...content(overrides),
  };
}

function Harness({ initial }: { initial: MultipleChoiceDocument }) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFeedback exercise={exercise} onChange={setExercise} />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: MultipleChoiceDocument = doc()) {
  render(<Harness initial={initial} />);
  return userEvent.setup();
}

/** The coverage strip's number, which the markup splits across two elements. */
function coverageReads(): string {
  return (document.querySelector('section p')?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('StepFeedback', () => {
  it('makes a missing rule a red field, not a note in the gate', () => {
    renderStep(doc({ questions: [question({ why: '' })] }));

    expect(screen.getByRole('textbox', { name: 'Why this answer is right' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByText('Write the rule behind the right answer.')).toBeInTheDocument();
  });

  it('counts the wrong options that have their own line', () => {
    renderStep();

    // The fixture writes a rebuttal on one of its two wrong options.
    expect(coverageReads()).toBe('1 / 2');
    expect(screen.getByText(/Every question explains its answer/)).toBeInTheDocument();
  });

  it('flips the written tick as soon as a line is typed', async () => {
    const user = renderStep();

    await user.type(
      screen.getByRole('textbox', { name: 'What to say when option C is picked' }),
      'Perfektum passer ikke her.',
    );

    expect(coverageReads()).toBe('2 / 2');
  });

  it('offers a line for every written wrong option and none for the key', () => {
    renderStep();

    expect(screen.getByRole('textbox', { name: 'What to say when option A is picked' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'What to say when option C is picked' })).toBeInTheDocument();
    // B is the key: the rule above is its explanation, and a rebuttal of the right answer
    // is not a thing to write.
    expect(screen.queryByRole('textbox', { name: 'What to say when option B is picked' })).toBeNull();
  });

  it('leaves empty options out — a student never sees them', () => {
    renderStep(
      doc({
        questions: [
          question({
            options: [
              option({ id: 'a', text: 'er' }),
              option({ id: 'b', text: 'var', correct: true }),
              option({ id: 'c', text: '' }),
            ],
          }),
        ],
      }),
    );

    expect(screen.queryByRole('textbox', { name: 'What to say when option C is picked' })).toBeNull();
  });

  it('restates the key beside the rule that explains it', () => {
    renderStep();

    expect(screen.getByText('var')).toBeInTheDocument();
  });

  it('says so when the key is missing rather than naming an option', () => {
    renderStep(
      doc({
        questions: [
          question({ options: [option({ id: 'a', text: 'er' }), option({ id: 'b', text: 'var' })] }),
        ],
      }),
    );

    expect(screen.getByText('no key')).toBeInTheDocument();
  });

  it('counts the questions still missing their rule', () => {
    renderStep(doc({ questions: [question(), question({ id: 'q2', why: '' })] }));

    expect(screen.getByText(/1 question still missing the rule/)).toBeInTheDocument();
  });
});
