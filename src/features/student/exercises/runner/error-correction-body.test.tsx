import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_HINTS, type StudentProjection } from '@/lib/shared-kernel/error-correction';

import { PRACTICE_ACCENT } from './types';
import { ErrorCorrectionBody, type ErrorCorrectionValue } from './error-correction-body';

// The projection is what the server sends: the faulty sentences, tokenised, and how
// many mistakes each holds. Nothing here knows *which* words are wrong — that is the
// point (BEHAVIOR §C.1).
function makeProjection(overrides: Partial<StudentProjection> = {}): StudentProjection {
  return {
    mode: 'sentences',
    note: '',
    items: [
      {
        id: 'i1',
        wrong: 'I går jeg gikk på kino.',
        words: ['I', 'går', 'jeg', 'gikk', 'på', 'kino.'],
        errorCount: 1,
        hint: 'Hva skjer med verbet?',
      },
    ],
    hints: { ...DEFAULT_HINTS },
    flow: {
      selfCheck: 2,
      attempts: 'free',
      showRefs: 'afterGraded',
      keyboard: true,
      showSpanCount: true,
    },
    totalErrors: 1,
    ...overrides,
  };
}

function renderBody(props: Partial<React.ComponentProps<typeof ErrorCorrectionBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ErrorCorrectionBody
        projection={makeProjection()}
        value={{}}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

/** The body with its own state, for interactions that build on each other. */
function Harness({ onValueChange }: { onValueChange?: (value: ErrorCorrectionValue) => void }) {
  const [value, setValue] = useState<ErrorCorrectionValue>({});

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ErrorCorrectionBody
        projection={makeProjection()}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
        onAnswerChange={vi.fn()}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
      />
    </NextIntlClientProvider>
  );
}

const word = (text: string) => screen.getByRole('button', { name: `Word: ${text}` });

describe('ErrorCorrectionBody', () => {
  it('renders every word as its own control', () => {
    renderBody();

    expect(word('I går'.split(' ')[0]!)).toBeInTheDocument();
    expect(word('gikk')).toBeInTheDocument();
    expect(word('kino.')).toBeInTheDocument();
  });

  it('says how many mistakes there are, without saying where', () => {
    renderBody();

    expect(screen.getByText('1 mistake to find')).toBeInTheDocument();
  });

  it('says nothing about the count when the author hid it', () => {
    const projection = makeProjection();
    const { totalErrors: _dropped, ...rest } = projection;
    renderBody({
      projection: {
        ...rest,
        items: [{ ...projection.items[0]!, errorCount: undefined }],
      } as StudentProjection,
    });

    expect(screen.queryByText(/mistake to find/)).not.toBeInTheDocument();
  });

  it('records a rewrite as an edit on that word', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(word('jeg'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gikk' } });
    fireEvent.blur(screen.getByRole('textbox'));

    expect(onValueChange).toHaveBeenCalledWith({
      i1: { marked: { 2: true }, fix: { 2: 'gikk' }, ins: {} },
    });
  });

  // A word left as it was is not a correction, and the count the learner is shown is a
  // count of corrections.
  it('does not mark a word the learner opened and left alone', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(word('jeg'));
    fireEvent.blur(screen.getByRole('textbox'));

    expect(onValueChange).toHaveBeenCalledWith({ i1: { marked: {}, fix: {}, ins: {} } });
  });

  it('strikes a word out when the field is left empty', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(word('jeg'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.blur(screen.getByRole('textbox'));

    expect(onValueChange).toHaveBeenCalledWith({
      i1: { marked: { 2: true }, fix: { 2: '' }, ins: {} },
    });
  });

  it('abandons the edit on Escape', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(word('jeg'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gikk' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('inserts a word between two others', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(screen.getByRole('button', { name: 'Insert a word at position 3' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ikke' } });
    fireEvent.blur(screen.getByRole('textbox'));

    expect(onValueChange).toHaveBeenCalledWith({
      i1: { marked: {}, fix: {}, ins: { 2: 'ikke' } },
    });
  });

  it('shows the rewritten word in place of the original', async () => {
    render(<Harness />);

    fireEvent.click(word('jeg'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gikk' } });
    fireEvent.blur(screen.getByRole('textbox'));

    expect(screen.queryByRole('button', { name: 'Word: jeg' })).not.toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: 'Word: gikk' })).toHaveLength(2);
  });

  it('undoes a marking on right-click', () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    fireEvent.click(word('jeg'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gikk' } });
    fireEvent.blur(screen.getByRole('textbox'));
    fireEvent.contextMenu(screen.getAllByRole('button', { name: 'Word: gikk' })[0]!);

    expect(onValueChange).toHaveBeenLastCalledWith({ i1: { marked: {}, fix: {}, ins: {} } });
  });

  it('offers the hint the author wrote, on request', async () => {
    render(<Harness />);

    expect(screen.queryByText('Hva skjer med verbet?')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByText('Hva skjer med verbet?')).toBeInTheDocument();
  });

  it('reports that the exercise can be handed in only once every sentence is touched', () => {
    const onAnswerChange = vi.fn();
    const { rerender } = renderBody({ onAnswerChange });

    expect(onAnswerChange).toHaveBeenLastCalledWith(false);

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ErrorCorrectionBody
          projection={makeProjection()}
          value={{ i1: { marked: { 2: true }, fix: { 2: 'gikk' }, ins: {} } }}
          onValueChange={vi.fn()}
          onAnswerChange={onAnswerChange}
          phase="answering"
          mode="practice"
          accent={PRACTICE_ACCENT}
        />
      </NextIntlClientProvider>,
    );

    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('stops accepting edits once the work has been handed in', () => {
    renderBody({ phase: 'feedback' });

    expect(word('jeg')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Insert a word at position 3' }),
    ).not.toBeInTheDocument();
  });
});
