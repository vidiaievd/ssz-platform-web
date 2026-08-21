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
  onClearMark,
  phase = 'answering' as const,
  results,
  revealed,
  showFeedback = true,
  initialValue = {},
}: {
  projection?: StudentProjection;
  onAnswerChange?: (canCheck: boolean) => void;
  onClearMark?: (slotId: string) => void;
  phase?: 'answering' | 'feedback';
  results?: Record<string, SlotVerdict>;
  revealed?: Record<string, RevealedSlot>;
  showFeedback?: boolean;
  initialValue?: MatchPairsValue;
}) {
  const [value, setValue] = useState<MatchPairsValue>(initialValue);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MatchPairsBody
        projection={projection}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange}
        {...(onClearMark === undefined ? {} : { onClearMark })}
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

  it('AC-S6: a half already in a slot is spent and does not respond', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('blir vi hjemme.'));

    // Trying to take it to another slot does nothing: it has to be given back first.
    await user.click(slot('Hvis det regner i morgen,'));
    await user.click(half('blir vi hjemme.'));

    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(
      'Kari tar imot Bartek — blir vi hjemme.',
    );
    expect(slot('Hvis det regner i morgen,')).toHaveAccessibleName(
      'Hvis det regner i morgen, — no half chosen',
    );
  });

  it('AC-S5: the × returns the half to the pool, and it can then go elsewhere', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('blir vi hjemme.'));
    await user.click(screen.getByRole('button', { name: 'Remove blir vi hjemme.' }));

    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(
      'Kari tar imot Bartek — no half chosen',
    );

    await user.click(slot('Hvis det regner i morgen,'));
    await user.click(half('blir vi hjemme.'));

    expect(slot('Hvis det regner i morgen,')).toHaveAccessibleName(
      'Hvis det regner i morgen, — blir vi hjemme.',
    );
  });

  it('AC-S2: tapping a filled slot arms it, so the next half replaces what is there', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('med et fast håndtrykk.'));

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(half('etter en uke.'));

    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(
      'Kari tar imot Bartek — etter en uke.',
    );
    // The half it replaced is back in the pool and usable again.
    expect(half('med et fast håndtrykk.')).toHaveAttribute('aria-disabled', 'false');
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

describe('MatchPairsBody — states are never colour alone', () => {
  const results: Record<string, SlotVerdict> = {
    p1: { correct: true, explanation: null },
    p2: { correct: false, explanation: 'Etter «fordi» står verbet etter subjektet.' },
  };

  it('AC-X7: a correct slot says so in words, not only in green', () => {
    render(<Harness results={results} initialValue={{ p1: 'r1', p2: 'r7' }} />);

    // The one state with no explanation to carry it — green border alone would be
    // the whole signal, which is exactly what AC-X7 forbids.
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Not right')).toBeInTheDocument();
  });

  it('AC-X7: the verdict is in the slot’s accessible name too', () => {
    render(<Harness results={results} initialValue={{ p1: 'r1', p2: 'r7' }} />);

    expect(slot('Kari tar imot Bartek')).toHaveAccessibleName(/correct$/);
    expect(slot('Han vil bytte jobb fordi')).toHaveAccessibleName(/not right$/);
  });

  it('announces the explanation as an alert and puts focus on the first one', () => {
    render(<Harness results={results} initialValue={{ p1: 'r1', p2: 'r7' }} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Etter «fordi» står verbet etter subjektet.');
    expect(alert).toHaveFocus();
  });
});

describe('MatchPairsBody — editing after a check', () => {
  it('AC-S11: editing a slot clears that slot’s mark and no other', async () => {
    const user = userEvent.setup();
    const cleared: string[] = [];
    render(
      <Harness
        results={{
          p1: { correct: true, explanation: null },
          p2: { correct: false, explanation: 'Etter «fordi» står verbet etter subjektet.' },
        }}
        onClearMark={(slotId) => cleared.push(slotId)}
        initialValue={{ p2: 'r7' }}
      />,
    );

    // p2 is wrong, so it is still editable: give its half back.
    await user.click(screen.getByRole('button', { name: /^Remove / }));

    expect(cleared).toEqual(['p2']);
  });
});

describe('MatchPairsBody — empty exercise', () => {
  it('AC-S18: says there are no pairs rather than rendering an empty frame', () => {
    render(<Harness projection={makeProjection({ slots: [], pool: [] })} />);

    expect(screen.getByText('This exercise has no pairs yet.')).toBeInTheDocument();
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
