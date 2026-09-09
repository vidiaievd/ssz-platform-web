import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type ShortAnswerContent } from '@/lib/shared-kernel/short-answer';

import { ShortAnswerPreview } from './short-answer-preview';

function doc(overrides: Partial<ShortAnswerContent> = {}): ShortAnswerContent {
  const content = emptyContent();
  const question = content.questions[0]!;

  return {
    ...content,
    instruction: 'Svar med én til tre setninger.',
    questions: [
      {
        ...question,
        kind: 'reading',
        passage: 'Fra 1. januar må alle syklister ha lys foran og bak.',
        prompt: 'Hva er nytt fra 1. januar?',
        model: 'Alle syklister må ha lys foran og bak.',
        why: 'Teksten sier hva regelen krever.',
        elements: [
          { id: 'e1', label: 'kravet', anchors: ['lys foran'], required: true },
          { id: 'e2', label: 'hvem det gjelder', anchors: ['alle syklister'], required: true },
        ],
      },
    ],
    ...overrides,
  };
}

function renderPreview(exercise: ShortAnswerContent = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ShortAnswerPreview exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

describe('ShortAnswerPreview', () => {
  it('says what a question is still missing rather than drawing an empty runner', () => {
    renderPreview(doc({ questions: doc().questions.map((q) => ({ ...q, model: '' })) }));

    expect(screen.getByText(/A question needs its text, a model answer/)).toBeInTheDocument();
  });

  it('renders the student view — instruction, passage and prompt', () => {
    renderPreview();

    expect(screen.getByText('Svar med én til tre setninger.')).toBeInTheDocument();
    expect(screen.getByText(/Fra 1. januar må alle syklister/)).toBeInTheDocument();
    expect(screen.getByText('Hva er nytt fra 1. januar?')).toBeInTheDocument();
  });

  it('hides the passage of a listening question, as the projection does for a student', () => {
    renderPreview(doc({ questions: doc().questions.map((q) => ({ ...q, kind: 'listening' })) }));

    expect(screen.queryByText(/Fra 1. januar må alle syklister/)).not.toBeInTheDocument();
    expect(screen.getByText('Hva er nytt fra 1. januar?')).toBeInTheDocument();
  });

  it('grades a real answer with the real key', async () => {
    const { user } = renderPreview();

    await user.type(screen.getByRole('textbox'), 'Alle syklister må ha lys foran.');
    await user.click(screen.getByRole('button', { name: /Hand in answer/ }));

    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 points covered')).toBeInTheDocument();
  });

  it('reports the elements an answer missed, by the teacher’s own labels', async () => {
    const { user } = renderPreview();

    await user.type(screen.getByRole('textbox'), 'De må ha lys foran når det er mørkt.');
    await user.click(screen.getByRole('button', { name: /Hand in answer/ }));

    expect(screen.getByText('Partly')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 points covered')).toBeInTheDocument();
    expect(screen.getByText('hvem det gjelder')).toBeInTheDocument();
  });

  it('never shows the anchor phrases — they are the answer in the student’s own words', async () => {
    const { user } = renderPreview();

    await user.type(screen.getByRole('textbox'), 'Alle syklister må ha lys foran.');
    await user.click(screen.getByRole('button', { name: /Hand in answer/ }));

    // The labels are shown; the phrasings the key looks for are not.
    expect(screen.getByText('kravet')).toBeInTheDocument();
    expect(screen.queryByText(/«lys foran»/)).not.toBeInTheDocument();
  });

  it('keeps the model answer back until the answer is in, under the default policy', async () => {
    const { user } = renderPreview();

    expect(screen.queryByText(/Alle syklister må ha lys foran og bak\./)).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'Alle syklister må ha lys foran.');
    await user.click(screen.getByRole('button', { name: /Hand in answer/ }));

    expect(screen.getByText(/Alle syklister må ha lys foran og bak\./)).toBeInTheDocument();
  });

  it('never reveals the model answer under showModel: never — the projection drops it', async () => {
    const { user } = renderPreview(doc({ settings: { ...doc().settings, showModel: 'never' } }));

    await user.type(screen.getByRole('textbox'), 'Alle syklister må ha lys foran.');
    await user.click(screen.getByRole('button', { name: /Hand in answer/ }));

    expect(screen.queryByText(/Alle syklister må ha lys foran og bak\./)).not.toBeInTheDocument();
  });
});
