import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_HINTS,
  type SelfCheckItem,
  type StudentProjection,
} from '@/lib/shared-kernel/error-correction';

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

  it('never says how many mistakes one sentence of several holds', () => {
    // The total is a hint about the task; a per-sentence count is a hint about *where*,
    // and it would let the learner skip whole sentences unread (BEHAVIOR §B).
    renderBody({
      projection: makeProjection({
        items: [
          {
            id: 'i1',
            wrong: 'I går jeg gikk på kino.',
            words: ['I', 'går', 'jeg', 'gikk', 'på', 'kino.'],
            errorCount: 1,
          },
          {
            id: 'i2',
            wrong: 'Hun har kjøp en bil.',
            words: ['Hun', 'har', 'kjøp', 'en', 'bil.'],
            errorCount: 1,
          },
        ],
        totalErrors: 2,
      }),
    });

    expect(screen.getByText('2 mistakes to find')).toBeInTheDocument();
    expect(screen.queryByText(/mistake here/)).not.toBeInTheDocument();
  });

  it('does say how many a passage holds — there the card is the whole task', () => {
    renderBody({ projection: makeProjection({ mode: 'passage' }) });

    expect(screen.getByText('1 mistake here')).toBeInTheDocument();
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

  /**
   * Plan 47 §4.1: once a teacher has read the submission, their word about one sentence
   * sits with that sentence — never invented, and never the reference it was checked
   * against.
   */
  it("shows a teacher's comment on the sentence it belongs to", () => {
    renderBody({ verdicts: { i1: { approved: false, comment: 'Sjekk verbtiden.' } } });

    expect(screen.getByText('not counted')).toBeInTheDocument();
    expect(screen.getByText('Sjekk verbtiden.')).toBeInTheDocument();
  });

  it('says a sentence was not counted without inventing a reason when the teacher wrote none', () => {
    renderBody({ verdicts: { i1: { approved: false } } });

    expect(screen.getByText('Your teacher did not count this one.')).toBeInTheDocument();
  });

  it('says nothing further about a sentence the teacher counted', () => {
    renderBody({ verdicts: { i1: { approved: true } } });

    expect(screen.getByText('counted')).toBeInTheDocument();
    expect(screen.queryByText('Your teacher did not count this one.')).not.toBeInTheDocument();
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

  describe('the æøå pad', () => {
    it('stays off until there is a field to write into', () => {
      render(<Harness />);

      expect(screen.getAllByRole('button', { name: 'å' })[0]).toBeDisabled();

      fireEvent.click(word('jeg'));

      expect(screen.getAllByRole('button', { name: 'å' })[0]).toBeEnabled();
    });

    it('writes the letter into the open word, and the edit sticks', () => {
      const onValueChange = vi.fn();
      render(<Harness onValueChange={onValueChange} />);

      fireEvent.click(word('kino.'));
      const field = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(field, { target: { value: 'f' } });
      field.setSelectionRange(1, 1);
      fireEvent.click(screen.getAllByRole('button', { name: 'å' })[0]!);
      fireEvent.blur(field);

      expect(onValueChange).toHaveBeenLastCalledWith({
        i1: { marked: { 5: true }, fix: { 5: 'få' }, ins: {} },
      });
    });

    it('is not offered when the author switched the keyboard off', () => {
      const projection = makeProjection();
      renderBody({
        projection: { ...projection, flow: { ...projection.flow, keyboard: false } },
      });

      expect(screen.queryByRole('button', { name: 'å' })).not.toBeInTheDocument();
    });
  });

  describe('the self-check the learner asked for', () => {
    const feedback = (item: Partial<SelfCheckItem> = {}) => ({
      fixedCount: 1,
      spanCount: 3,
      items: [
        {
          itemId: 'i1',
          fixedCount: 1,
          spanCount: 3,
          fixedSpans: [true, false, false],
          strayEdits: 0,
          ...item,
        },
      ],
    });

    it('reports how many mistakes are corrected, and never which words are wrong', () => {
      renderBody({ selfCheck: feedback() });

      expect(screen.getByText('1 of 3 corrected here.')).toBeInTheDocument();
      expect(screen.getByText('2 mistakes are still left')).toBeInTheDocument();
    });

    it('names the types of the mistakes left only when the author allowed it', () => {
      renderBody({
        selfCheck: feedback({ remainingTypes: ['order', 'form'] }),
      });

      expect(
        screen.getByText('2 mistakes are still left — word order, word form'),
      ).toBeInTheDocument();
    });

    it('says out loud that a change landed where there was no mistake', () => {
      renderBody({ selfCheck: feedback({ strayEdits: 2 }) });

      expect(
        screen.getByText('You also changed 2 words where there was no mistake'),
      ).toBeInTheDocument();
    });

    it('keeps the pips to itself when the author switched the count off', () => {
      const projection = makeProjection();
      renderBody({
        projection: { ...projection, flow: { ...projection.flow, showSpanCount: false } },
        selfCheck: feedback(),
      });

      expect(screen.queryByText('1/3')).not.toBeInTheDocument();
      // The headline still stands: the setting governs the pips, not the count itself.
      expect(screen.getByText('1 of 3 corrected here.')).toBeInTheDocument();
    });

    it('shows nothing at all before the learner has asked', () => {
      renderBody();

      expect(screen.queryByText(/corrected here/)).not.toBeInTheDocument();
    });
  });

  it('stops accepting edits once the work has been handed in', () => {
    renderBody({ phase: 'feedback' });

    expect(word('jeg')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Insert a word at position 3' }),
    ).not.toBeInTheDocument();
  });
});
