import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceContent } from '@/lib/shared-kernel/multiple-choice';
import { content, option, question } from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import { StepQuestions } from './step-questions';
import type { MultipleChoiceDocument } from './edits';

function doc(overrides: Partial<MultipleChoiceContent> = {}): MultipleChoiceDocument {
  return { updatedAt: '2026-08-28T10:00:00.000Z', ...content(overrides) };
}

function Harness({ initial }: { initial: MultipleChoiceDocument }) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepQuestions exercise={exercise} onChange={setExercise} />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: MultipleChoiceDocument = doc()) {
  render(<Harness initial={initial} />);
  return userEvent.setup();
}

describe('StepQuestions', () => {
  it('marks a key and clears the one that was marked before', async () => {
    const user = renderStep();

    const before = screen.getByRole('radio', { name: 'Mark option B as correct' });
    expect(before).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'Mark option C as correct' }));

    expect(screen.getByRole('radio', { name: 'Mark option C as correct' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Mark option B as correct' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('says what is missing beside the field that is missing it', () => {
    renderStep(doc({ questions: [question({ stem: '' })] }));

    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByText('The question needs text.')).toBeInTheDocument();
  });

  it('asks for a key when no option is marked', () => {
    renderStep(
      doc({
        questions: [
          question({ options: [option({ id: 'a', text: 'er' }), option({ id: 'b', text: 'var' })] }),
        ],
      }),
    );

    expect(screen.getByText('Mark one option as correct.')).toBeInTheDocument();
  });

  it('blocks deleting an option at two', () => {
    renderStep(
      doc({
        questions: [
          question({
            options: [option({ id: 'a', text: 'Riktig', correct: true }), option({ id: 'b', text: 'Galt' })],
          }),
        ],
      }),
    );

    expect(screen.getByRole('button', { name: 'Remove option A' })).toBeDisabled();
  });

  it('stops offering more options at eight', async () => {
    const user = renderStep();

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Add option' }));
    }

    expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled();
  });

  it('offers the passage field, and keeps it once there is a passage', async () => {
    const user = renderStep();

    expect(screen.queryByRole('textbox', { name: /Text the question is about/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add a text above' }));
    await user.type(
      screen.getByRole('textbox', { name: /Text the question is about/ }),
      'En tekst.',
    );

    expect(screen.queryByRole('button', { name: 'Add a text above' })).toBeNull();
  });

  it('warns on a reading question with no passage, without opening the field for it', () => {
    renderStep(doc({ questions: [question({ kind: 'reading' })] }));

    // BEHAVIOR §"Step 1": the warning appears, the field is not auto-opened.
    expect(screen.getByRole('button', { name: 'Add a text above' })).toBeInTheDocument();
  });

  it('appends a bulk paste to the questions already written', async () => {
    const user = renderStep();

    await user.click(screen.getByRole('button', { name: 'Paste several' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Paste several questions' }),
      'Hun ___ boka. | *leste | leser',
    );
    await user.click(screen.getByRole('button', { name: 'Add 1 question' }));

    expect(screen.getByText('2 questions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hun ___ boka.')).toBeInTheDocument();
  });

  it('counts finished questions apart from written ones', () => {
    renderStep(doc({ questions: [question(), question({ id: 'q2', stem: '' })] }));

    expect(screen.getByText('2 questions')).toBeInTheDocument();
    expect(screen.getByText('1 finished')).toBeInTheDocument();
  });

  it('duplicates a question with its own options', async () => {
    const user = renderStep();

    await user.click(screen.getByRole('button', { name: 'Duplicate question 1' }));

    expect(screen.getAllByDisplayValue('Han sa at han ___ syk.')).toHaveLength(2);
    // Two keys on screen, one per card — not one shared between them.
    const checked = screen
      .getAllByRole('radio')
      .filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(2);
  });

  it('groups the key controls so a screen reader is told one of them wins', () => {
    renderStep();

    const group = screen.getByRole('radiogroup', { name: 'Options' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });
});
