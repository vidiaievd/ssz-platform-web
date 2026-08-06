import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  coverage,
  DEFAULT_SETTINGS,
  gaps,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { acceptDraft, draftFor, pairDraftContext, rejectDraft } from './ai-draft';
import { FeedbackMatrix } from './feedback-matrix';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: '',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }],
    distractors: ['bestilt'],
    feedback: {
      's1#3': {
        fallback: 'Her mangler verbet.',
        why: '',
        pairs: { bestilt: { text: 'Perfektum, ikke infinitiv.', origin: 'ai_draft' } },
      },
    },
    updatedAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  };
}

function Harness({ initial }: { initial: WordBankGapFill }) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FeedbackMatrix exercise={exercise} onChange={setExercise} />
      <output data-testid="coverage">{`${coverage(exercise).written}/${coverage(exercise).total}`}</output>
    </NextIntlClientProvider>
  );
}

describe('AI draft extension points', () => {
  it('does not count an unaccepted draft as coverage', () => {
    const drafted = doc();
    expect(coverage(drafted).written).toBe(0);

    const accepted = acceptDraft(drafted, 's1#3', 'bestilt');
    expect(coverage(accepted).written).toBe(1);
  });

  it('accepting makes the text the teacher’s own', () => {
    const accepted = acceptDraft(doc(), 's1#3', 'bestilt');

    expect(accepted.feedback['s1#3']?.pairs.bestilt).toEqual({
      text: 'Perfektum, ikke infinitiv.',
      origin: 'author',
    });
    expect(draftFor(accepted, 's1#3', 'bestilt')).toBeNull();
  });

  it('rejecting empties the cell, so the gap default applies again', () => {
    const rejected = rejectDraft(doc(), 's1#3', 'bestilt');

    expect(rejected.feedback['s1#3']?.pairs.bestilt).toBeUndefined();
  });

  it('leaves a teacher’s own text alone', () => {
    const authored = doc({
      feedback: {
        's1#3': {
          fallback: 'Her mangler verbet.',
          why: '',
          pairs: { bestilt: { text: 'Mitt eget svar.', origin: 'author' } },
        },
      },
    });

    expect(draftFor(authored, 's1#3', 'bestilt')).toBeNull();
    expect(rejectDraft(authored, 's1#3', 'bestilt')).toBe(authored);
    expect(acceptDraft(authored, 's1#3', 'bestilt')).toBe(authored);
  });

  it('collects what a generator would need for one pair', () => {
    const exercise = doc();
    const gap = gaps(exercise)[0]!;

    expect(pairDraftContext(exercise, gap, 'bestilt', 'Infinitiv etter modalverb')).toEqual({
      sentence: 'Jeg vil gjerne bestille en kaffe.',
      answer: 'bestille',
      chosenWord: 'bestilt',
      fallback: 'Her mangler verbet.',
      grammarPoint: 'Infinitiv etter modalverb',
    });
  });

  it('offers a draft for decision in the cell editor, and counts it once accepted', async () => {
    const user = userEvent.setup();
    render(<Harness initial={doc()} />);

    await user.click(screen.getByRole('button', { name: 'Write an explanation for G1 × bestilt' }));

    // Shown as something to decide about, not as text already in the field.
    expect(screen.getByText('Suggested draft — not shown to students yet')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Edit the explanation for G1 × bestilt' }),
    ).toHaveValue('');
    expect(screen.getByTestId('coverage')).toHaveTextContent('0/1');

    await user.click(screen.getByRole('button', { name: 'Use this' }));

    expect(screen.getByTestId('coverage')).toHaveTextContent('1/1');
    expect(
      screen.queryByText('Suggested draft — not shown to students yet'),
    ).not.toBeInTheDocument();
  });

  it('shows no drafting control while the feature is off (AC: identical to step 4.4)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={doc({ feedback: {} })} />);

    await user.click(screen.getByRole('button', { name: 'Write an explanation for G1 × bestilt' }));

    expect(screen.queryByRole('button', { name: 'Draft with AI' })).not.toBeInTheDocument();
  });
});
