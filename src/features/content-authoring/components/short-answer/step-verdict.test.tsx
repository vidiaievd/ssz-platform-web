import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type ShortAnswerContent } from '@/lib/shared-kernel/short-answer';

import { StepVerdict } from './step-verdict';
import type { ShortAnswerDocument } from './edits';

function doc(overrides: Partial<ShortAnswerContent> = {}): ShortAnswerDocument {
  const content = emptyContent();
  const question = content.questions[0]!;

  return {
    updatedAt: '2026-08-23T10:00:00.000Z',
    ...content,
    questions: [
      {
        ...question,
        id: 'q1',
        prompt: 'Hva er nytt fra 1. januar?',
        model: 'Alle syklister må ha lys foran og bak.',
        why: 'Teksten sier hva regelen krever.',
        elements: [{ id: 'e1', label: 'kravet', anchors: ['lys foran'], required: true }],
      },
    ],
    ...overrides,
  };
}

function renderStep(exercise: ShortAnswerDocument = doc()) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepVerdict exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepVerdict', () => {
  it('offers the count only once a pass asks for some elements rather than all', async () => {
    const { onChange, user } = renderStep();

    expect(screen.queryByLabelText('How many')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Some of them' }));

    expect((onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).settings.passRule).toBe('n');
  });

  it('warns beside the count when it asks for more elements than a question has', () => {
    renderStep(doc({ settings: { ...doc().settings, passRule: 'n', passN: 3 } }));

    expect(
      screen.getByText('A pass asks for 3 elements, and some question has fewer.'),
    ).toBeInTheDocument();
  });

  it('says the length rule flags rather than fails, and that the student sees no counter', () => {
    renderStep();

    expect(screen.getByText(/flagged as too short instead of failed outright/)).toBeInTheDocument();
    expect(screen.getByText(/never sees a word counter/)).toBeInTheDocument();
  });

  it('switches the length check off', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('radio', { name: 'off' }));

    expect((onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).settings.minWords).toBe(0);
  });

  it('turns the breakdown off without touching the rest of the settings', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Show the element breakdown/ }));

    const next = (onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).settings;
    expect(next.showBreakdown).toBe(false);
    expect(next.typos).toBe(true);
    expect(next.progress).toBe(true);
  });

  it('sets the model-answer policy to never', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('radio', { name: 'Never' }));

    expect((onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).settings.showModel).toBe(
      'never',
    );
  });

  it('marks a question with no explanation on its own card', () => {
    renderStep(doc({ questions: doc().questions.map((q) => ({ ...q, why: '' })) }));

    expect(screen.getByLabelText('Why the answer is what it is')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      screen.getByText('A question has no explanation to show under the verdict.'),
    ).toBeInTheDocument();
  });

  it('writes the explanation onto the question it belongs to', async () => {
    const second = { ...doc().questions[0]!, id: 'q2', why: '' };
    const { onChange, user } = renderStep(doc({ questions: [...doc().questions, second] }));

    await user.type(screen.getAllByLabelText('Why the answer is what it is')[1]!, 'X');

    const next = onChange.mock.calls.at(-1)![0] as ShortAnswerDocument;
    expect(next.questions[1]!.why).toBe('X');
    expect(next.questions[0]!.why).toBe('Teksten sier hva regelen krever.');
  });
});
