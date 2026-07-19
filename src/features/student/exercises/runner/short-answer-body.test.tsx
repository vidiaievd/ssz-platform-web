import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { ShortAnswerBody, type ShortAnswerContent } from './short-answer-body';

const messages = {
  ExerciseRunner: {
    shortAnswer: {
      defaultInstruction: 'Answer the question',
      inputLabel: 'Your answer',
      placeholder: 'Write your answer…',
      referenceLabel: 'Sample answer',
    },
  },
};

const CONTENT: ShortAnswerContent = {
  question: 'Når hørte Anne nyheten?',
  context: 'Tekst 19A',
};
const ACCENT = 'var(--ssz-color-primary-500)';

function Harness({
  onAnswerChange,
  phase = 'answering',
  ok = null,
  referenceAnswer,
}: {
  onAnswerChange?: (canSubmit: boolean) => void;
  phase?: 'answering' | 'feedback';
  ok?: boolean | null;
  referenceAnswer?: string;
}) {
  const [value, setValue] = useState('');
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <ShortAnswerBody
        content={CONTENT}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange ?? (() => {})}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        referenceAnswer={referenceAnswer}
      />
    </NextIntlClientProvider>
  );
}

describe('ShortAnswerBody', () => {
  it('renders the question and context', () => {
    render(<Harness />);
    expect(screen.getByText('Når hørte Anne nyheten?')).toBeInTheDocument();
    expect(screen.getByText('Tekst 19A')).toBeInTheDocument();
  });

  it('reports canSubmit=true once the learner types', () => {
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'på radio' } });
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('reveals the reference answer only in the feedback phase', () => {
    const { rerender } = render(<Harness phase="answering" referenceAnswer="På radio." />);
    expect(screen.queryByText('På radio.')).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ShortAnswerBody
          content={CONTENT}
          value="x"
          onValueChange={() => {}}
          onAnswerChange={() => {}}
          phase="feedback"
          ok={null}
          mode="practice"
          accent={ACCENT}
          referenceAnswer="På radio."
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('På radio.')).toBeInTheDocument();
  });
});
