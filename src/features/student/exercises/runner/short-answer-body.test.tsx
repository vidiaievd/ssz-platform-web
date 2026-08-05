import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { ShortAnswerBody, type ShortAnswerContent } from './short-answer-body';
import type { DiffToken } from '@/lib/exercises/short-answer-diff';

const messages = {
  ExerciseRunner: {
    shortAnswer: {
      defaultInstruction: 'Answer the question',
      inputLabel: 'Your answer',
      placeholder: 'Write your answer…',
      referenceLabel: 'Sample answer',
      diffLabel: 'Your answer, checked',
      diffForm: 'Wrong form of the word',
      diffWrong: 'Wrong word',
      diffExtra: 'Extra word',
      diffMissing: 'Missing word',
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
  diff,
}: {
  onAnswerChange?: (canSubmit: boolean) => void;
  phase?: 'answering' | 'feedback';
  ok?: boolean | null;
  referenceAnswer?: string;
  diff?: DiffToken[];
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
        diff={diff}
      />
    </NextIntlClientProvider>
  );
}

const NEAR_MISS: DiffToken[] = [
  { outcome: 'missing', expected: 'at' },
  { outcome: 'ok', submitted: 'han', expected: 'han' },
  { outcome: 'ok', submitted: 'skulle', expected: 'skulle' },
  { outcome: 'form', submitted: 'begynte', expected: 'begynne' },
];

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

  it('marks up a near miss word by word once checked', () => {
    render(<Harness phase="feedback" ok={false} diff={NEAR_MISS} />);
    expect(screen.getByText('Your answer, checked')).toBeInTheDocument();
    // The word the learner got wrong, and what belonged there.
    expect(screen.getByText('begynte')).toBeInTheDocument();
    expect(screen.getByText('begynne')).toBeInTheDocument();
    // The word they never wrote is filled in as missing.
    expect(screen.getByTitle('Missing word')).toHaveTextContent('at');
    expect(screen.getByTitle('Wrong form of the word')).toBeInTheDocument();
  });

  it('holds the markup back while the learner is still answering', () => {
    render(<Harness phase="answering" diff={NEAR_MISS} />);
    expect(screen.queryByText('Your answer, checked')).not.toBeInTheDocument();
  });

  it('skips the markup for a correct answer — there is nothing to fix', () => {
    render(
      <Harness
        phase="feedback"
        ok
        diff={[{ outcome: 'ok', submitted: 'han', expected: 'han' }]}
      />,
    );
    expect(screen.queryByText('Your answer, checked')).not.toBeInTheDocument();
  });
});
