import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type ShortAnswerContent } from '@/lib/shared-kernel/short-answer';

import { StepKey } from './step-key';
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
        kind: 'reading',
        passage: 'Fra 1. januar må alle syklister ha lys foran og bak.',
        prompt: 'Hva er nytt fra 1. januar?',
        model: 'Alle syklister må ha lys foran og bak.',
        why: 'Teksten sier hva regelen krever.',
        elements: [
          { id: 'e1', label: 'kravet', anchors: ['lys foran', 'foran og bak'], required: true },
        ],
      },
    ],
    ...overrides,
  };
}

/** The same document with the key rewritten so the model answer no longer passes it. */
function brokenKey(): ShortAnswerDocument {
  return doc({
    questions: doc().questions.map((q) => ({
      ...q,
      elements: [{ id: 'e1', label: 'kravet', anchors: ['refleksvest'], required: true }],
    })),
  });
}

function renderStep(exercise: ShortAnswerDocument = doc()) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepKey exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepKey', () => {
  it('counts model answers that pass, and phrases across the exercise', () => {
    renderStep();

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('2 phrases across the exercise')).toBeInTheDocument();
  });

  it('says on the card that the model answer does not pass its own key', () => {
    renderStep(brokenKey());

    expect(screen.getByText('Does not pass')).toBeInTheDocument();
    expect(
      screen.getByText(/Your own model answer only covers 0 of 1 elements/),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('marks the element the model answer covers, naming the phrase that matched', () => {
    renderStep();

    expect(screen.getByText('Your model answer says this — «lys foran».')).toBeInTheDocument();
  });

  it('renders the audit under the element it is about', () => {
    // One anchor, and it is not in the model answer: a warning and an observation, both
    // belonging to this row and to no other.
    renderStep(
      doc({
        questions: doc().questions.map((q) => ({
          ...q,
          elements: [{ id: 'e1', label: 'kravet', anchors: ['refleksvest'], required: true }],
        })),
      }),
    );

    expect(
      screen.getByText('Question 1, element 1: your model answer does not contain «refleksvest».'),
    ).toBeInTheDocument();
    expect(screen.getByText(/one phrase only/)).toBeInTheDocument();
  });

  it('flags an anchor short enough to match by accident', () => {
    renderStep(
      doc({
        questions: doc().questions.map((q) => ({
          ...q,
          elements: [{ id: 'e1', label: 'kravet', anchors: ['lys', 'lys foran'], required: true }],
        })),
      }),
    );

    expect(
      screen.getByText('Question 1, element 1: «lys» is short enough to appear by accident.'),
    ).toBeInTheDocument();
  });

  it('says the question has no usable element yet, on the card', () => {
    renderStep(
      doc({
        questions: doc().questions.map((q) => ({
          ...q,
          elements: [{ id: 'e1', label: 'kravet', anchors: [], required: true }],
        })),
      }),
    );

    expect(screen.getByText('no key')).toBeInTheDocument();
    expect(screen.getByText(/has no usable element/)).toBeInTheDocument();
  });

  it('commits a phrase on Enter', async () => {
    const { onChange, user } = renderStep();

    await user.type(screen.getByLabelText('Phrases for element 1'), 'lys bak{Enter}');

    const next = onChange.mock.calls.at(-1)![0] as ShortAnswerDocument;
    expect(next.questions[0]!.elements[0]!.anchors).toContain('lys bak');
  });

  it('commits a phrase on blur too — a typed phrase is never thrown away', async () => {
    const { onChange, user } = renderStep();

    await user.type(screen.getByLabelText('Phrases for element 1'), 'lys bak');
    await user.tab();

    const next = onChange.mock.calls.at(-1)![0] as ShortAnswerDocument;
    expect(next.questions[0]!.elements[0]!.anchors).toContain('lys bak');
  });

  it('removes a phrase by its own labelled button', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Remove “lys foran”' }));

    const next = onChange.mock.calls.at(-1)![0] as ShortAnswerDocument;
    expect(next.questions[0]!.elements[0]!.anchors).toEqual(['foran og bak']);
  });

  it('refuses to delete the last element', () => {
    renderStep();

    expect(screen.getByRole('button', { name: 'Remove element 1' })).toBeDisabled();
  });

  it('runs the real grader on a tried answer, chip by chip', async () => {
    const twoElements = doc({
      questions: doc().questions.map((q) => ({
        ...q,
        elements: [
          { id: 'e1', label: 'kravet', anchors: ['lys foran'], required: true },
          { id: 'e2', label: 'hvem det gjelder', anchors: ['alle syklister'], required: true },
        ],
      })),
    });
    const { user } = renderStep(twoElements);

    await user.type(
      screen.getByLabelText('Try a student answer'),
      'De må ha lys foran når det er mørkt.',
    );

    const result = screen.getByRole('status');
    expect(within(result).getByText('Partly')).toBeInTheDocument();
    expect(within(result).getByText('kravet · «lys foran»')).toBeInTheDocument();
    expect(within(result).getByText('hvem det gjelder')).toBeInTheDocument();
  });

  it('stores nothing from the tester, and clears its result with the box', async () => {
    const { onChange, user } = renderStep();
    const tester = screen.getByLabelText('Try a student answer');

    await user.type(tester, 'lys foran');
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.clear(tester);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
