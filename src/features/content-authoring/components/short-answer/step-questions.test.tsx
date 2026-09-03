import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import {
  emptyContent,
  TEMPLATE_CODE,
  type ShortAnswerContent,
} from '@/lib/shared-kernel/short-answer';

import { StepQuestions } from './step-questions';
import type { ShortAnswerDocument } from './edits';

function doc(overrides: Partial<ShortAnswerContent> = {}): ShortAnswerDocument {
  const content = emptyContent();
  const question = content.questions[0]!;

  return {
    updatedAt: '2026-08-23T10:00:00.000Z',
    // Every builder document carries the audio layer, and an exercise that has never had
    // any reads as switched off (plan 56 phase 5).
    audio: readAudioDraft({}, TEMPLATE_CODE),
    ...content,
    questions: [
      {
        ...question,
        kind: 'reading',
        passage: 'Fra 1. januar må alle syklister ha lys foran og bak.',
        prompt: 'Hva er nytt fra 1. januar?',
        model: 'Alle syklister må ha lys foran og bak.',
        why: 'Teksten sier hva regelen krever.',
        elements: [
          { ...question.elements[0]!, label: 'kravet', anchors: ['lys foran'], required: true },
        ],
      },
    ],
    ...overrides,
  };
}

function renderStep(exercise: ShortAnswerDocument = doc()) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepQuestions exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepQuestions', () => {
  it('counts what is written and what is answerable separately', () => {
    const half = { ...doc().questions[0]!, id: 'q2', model: '' };
    renderStep(doc({ questions: [...doc().questions, half] }));

    expect(screen.getByText('2 questions')).toBeInTheDocument();
    expect(screen.getByText('1 ready to answer')).toBeInTheDocument();
  });

  it('says on the card that a question has no text — not only in the gate', () => {
    renderStep(doc({ questions: doc().questions.map((q) => ({ ...q, prompt: '' })) }));

    expect(screen.getByLabelText('Question')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('A question has no text.')).toBeInTheDocument();
  });

  it('asks for the model answer only once there is a question to answer', () => {
    renderStep(doc({ questions: doc().questions.map((q) => ({ ...q, prompt: '', model: '' })) }));

    // One red field on an untouched card, not two saying the same thing.
    expect(screen.getByText('A question has no text.')).toBeInTheDocument();
    expect(
      screen.queryByText('A question has no model answer — the key is built from it.'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Model answer')).toHaveAttribute('aria-invalid', 'false');
  });

  it('warns about a reading question with no text, without calling it an error', () => {
    renderStep(doc({ questions: doc().questions.map((q) => ({ ...q, passage: '' })) }));

    expect(
      screen.getByText('A reading question with no text has nothing to understand.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Text the question is about')).not.toHaveAttribute('aria-invalid');
  });

  it('relabels the passage for a listening question and says it stays author-side', () => {
    renderStep(
      doc({ questions: doc().questions.map((q) => ({ ...q, kind: 'listening' as const })) }),
    );

    expect(screen.getByLabelText('What the audio says')).toBeInTheDocument();
    expect(screen.getByText(/it is the transcript you write the key from/)).toBeInTheDocument();
  });

  it('offers no passage field for an opinion question', () => {
    renderStep(
      doc({ questions: doc().questions.map((q) => ({ ...q, kind: 'opinion' as const })) }),
    );

    expect(screen.queryByLabelText('Text the question is about')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('What the audio says')).not.toBeInTheDocument();
  });

  it('duplicates a question with a key of its own', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Duplicate question 1' }));

    const next = onChange.mock.calls[0]![0] as ShortAnswerDocument;
    const [original, copy] = next.questions;
    expect(next.questions).toHaveLength(2);
    expect(copy!.prompt).toBe(original!.prompt);
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.elements[0]!.id).not.toBe(original!.elements[0]!.id);
  });

  it('deletes without asking, and says so when the set runs out', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Delete question 1' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((onChange.mock.calls[0]![0] as ShortAnswerDocument).questions).toHaveLength(0);
  });

  it('reports an empty set on the step itself', () => {
    renderStep(doc({ questions: [] }));

    expect(screen.getByText('The set has no questions yet — add one.')).toBeInTheDocument();
  });

  it('adds a question with a reading kind and one empty element', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: /Add question/ }));

    const added = (onChange.mock.calls[0]![0] as ShortAnswerDocument).questions[1]!;
    expect(added.kind).toBe('reading');
    expect(added.elements).toHaveLength(1);
    expect(added.prompt).toBe('');
  });

  it('writes the instruction onto the document', async () => {
    const { onChange, user } = renderStep();

    await user.type(screen.getByLabelText('Instruction to the student'), '!');

    expect((onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).instruction).toBe('!');
  });
});
