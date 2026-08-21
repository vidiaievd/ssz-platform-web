import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { StudentProjection } from '@/lib/shared-kernel/match-pairs';

import {
  MatchPairsBody,
  type MatchPairsValue,
  type RevealedSlot,
  type SlotVerdict,
} from './match-pairs-body';

/**
 * The projection is what the server sends: left halves as slots, a flat pool already
 * shuffled. The pool is deliberately longer than the slots — `r7` and `r8` are
 * distractors, and nothing in here says so. That asymmetry is the shape the old
 * two-column body could not render, and the reason the last slot no longer solves
 * itself by elimination.
 */
function makeProjection(overrides: Partial<StudentProjection> = {}): StudentProjection {
  return {
    variant: 'halves',
    slots: [
      { slotId: 'p1', left: 'Kari tar imot Bartek' },
      { slotId: 'p2', left: 'Han vil bytte jobb fordi' },
      { slotId: 'p3', left: 'Hvis det regner i morgen,' },
    ],
    pool: [
      { itemId: 'r2', text: 'han vil ta mer ansvar.' },
      { itemId: 'r7', text: 'vil han ta mer ansvar.' },
      { itemId: 'r1', text: 'med et fast håndtrykk.' },
      { itemId: 'r3', text: 'blir vi hjemme.' },
      { itemId: 'r8', text: 'etter en uke.' },
    ],
    settings: { showRemaining: true },
    ...overrides,
  };
}

function Harness({
  projection = makeProjection(),
  onAnswerChange = vi.fn(),
  phase = 'answering' as const,
  results,
  revealed,
  showFeedback = true,
}: {
  projection?: StudentProjection;
  onAnswerChange?: (canCheck: boolean) => void;
  phase?: 'answering' | 'feedback';
  results?: Record<string, SlotVerdict>;
  revealed?: Record<string, RevealedSlot>;
  showFeedback?: boolean;
}) {
  const [value, setValue] = useState<MatchPairsValue>({});
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MatchPairsBody
        projection={projection}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange}
        phase={phase}
        mode="practice"
        accent="var(--ssz-runner-practice)"
        showFeedback={showFeedback}
        {...(results === undefined ? {} : { results })}
        {...(revealed === undefined ? {} : { revealed })}
      />
    </NextIntlClientProvider>
  );
}

const slot = (left: string) => screen.getByRole('button', { name: new RegExp(`^${left}`) });
const half = (text: string) => screen.getByRole('button', { name: text });

describe('MatchPairsBody — placing halves', () => {
  it('slot first, then the half that completes it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Han vil bytte jobb fordi'));
    await user.click(half('han vil ta mer ansvar.'));

    expect(slot('Han vil bytte jobb fordi')).toHaveAccessibleName(
      'Han vil bytte jobb fordi — han vil ta mer ansvar.',
    );
  });

  it('half first, then the slot it completes — the same placement from the other end', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(half('blir vi hjemme.'));
    await user.click(slot('Hvis det regner i morgen,'));

    expect(slot('Hvis det regner i morgen,')).toHaveAccessibleName(
      'Hvis det regner i morgen, — blir vi hjemme.',
    );
  });

  it('a half lives in exactly one slot: moving it empties the slot it came from', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('blir vi hjemme.'));
    // Now take the same half to another slot.
    await user.click(slot('Hvis det regner i morgen,'));
    await user.click(half('blir vi hjemme.'));

    expect(slot('Hvis det regner i morgen,')).toHaveAccessibleName(
      'Hvis det regner i morgen, — blir vi hjemme.',
    );
    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(
      'Kari tar imot Bartek — no half chosen',
    );
  });

  it('tapping a filled slot gives the half back', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('med et fast håndtrykk.'));
    await user.click(slot('Kari tar imot Bartek'));

    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(
      'Kari tar imot Bartek — no half chosen',
    );
  });

  it('AC-S7: one filled slot is enough to check', async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);

    expect(onAnswerChange).toHaveBeenLastCalledWith(false);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('med et fast håndtrykk.'));

    // Two slots are still empty; partial checking is the point of the type.
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('counts down what is left to match, not what is left in the pool', () => {
    // Five halves for three slots: the distractors must not inflate the count, or a
    // learner who matched everything would still be told there are two to go.
    render(<Harness />);
    expect(screen.getByText('3 left')).toBeInTheDocument();
  });
});

describe('MatchPairsBody — feedback', () => {
  const results: Record<string, SlotVerdict> = {
    p1: { correct: true, explanation: null },
    p2: { correct: false, explanation: 'Etter «fordi» står verbet etter subjektet.' },
  };

  it('explains the half actually attached, and never names the right one', () => {
    render(<Harness results={results} />);

    expect(screen.getByText('Etter «fordi» står verbet etter subjektet.')).toBeInTheDocument();
    // The correct half for p2 is in the pool, but nothing on screen points at it.
    expect(screen.queryByText(/the answer is/i)).not.toBeInTheDocument();
  });

  it('AC-S9: a slot the server called correct stops accepting halves', async () => {
    const user = userEvent.setup();
    render(<Harness results={results} />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('etter en uke.'));

    // p1 is locked by its verdict; the tap on the pool must not land there.
    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(
      'Kari tar imot Bartek — no half chosen',
    );
  });

  it('drops the explanations once the learner goes back to matching, keeping the locks', () => {
    render(<Harness results={results} showFeedback={false} />);

    expect(
      screen.queryByText('Etter «fordi» står verbet etter subjektet.'),
    ).not.toBeInTheDocument();
  });

  it('shows the answers in their slots only once revealed, with the teacher’s note', () => {
    render(
      <Harness
        phase="feedback"
        revealed={{
          p2: { rightId: 'r2', text: 'han vil ta mer ansvar.', why: 'Leddsetning: subjekt før verb.' },
        }}
      />,
    );

    // The slot announces what it shows: the answer, not the empty slot beneath it.
    expect(slot('Han vil bytte jobb fordi')).toHaveAccessibleName(
      'Han vil bytte jobb fordi — the answer is han vil ta mer ansvar.',
    );
    expect(screen.getByText('Leddsetning: subjekt før verb.')).toBeInTheDocument();
  });
});
