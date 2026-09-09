import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { AUDIO_DEFAULT } from '@/lib/shared-kernel/audio';
import type { ExerciseAudioEngine } from '@/features/student/exercises/audio';
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
  audio,
}: {
  projection?: StudentProjection;
  onAnswerChange?: (canCheck: boolean) => void;
  onClearMark?: (slotId: string) => void;
  phase?: 'answering' | 'feedback';
  results?: Record<string, SlotVerdict>;
  revealed?: Record<string, RevealedSlot>;
  showFeedback?: boolean;
  initialValue?: MatchPairsValue;
  audio?: ExerciseAudioEngine;
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
        {...(audio === undefined ? {} : { audio })}
      />
    </NextIntlClientProvider>
  );
}

const slot = (left: string) => screen.getByRole('button', { name: new RegExp(`^${left}`) });
const half = (text: string) => screen.getByRole('button', { name: text });

/**
 * The desktop layout, where the pool has a column of its own and is on screen
 * throughout. JSDOM measures every element at 0, which is the phone branch — so the
 * two layouts are told apart here the same way the component tells them apart: by how
 * much room it is given.
 */
function renderWide(ui: ReactElement) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 900,
    height: 600,
    top: 0,
    left: 0,
    right: 900,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return render(ui);
}

afterEach(() => vi.restoreAllMocks());

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
    renderWide(<Harness />);

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
    renderWide(<Harness />);

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
    renderWide(<Harness results={results} />);

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

describe('MatchPairsBody — on a phone', () => {
  /**
   * The pool has nowhere to live at this width: eight clause-long halves parked at the
   * bottom leave the sentences a sliver to share. So it is not parked — it opens under
   * the sentence being answered, and closes again when one is chosen.
   */
  it('keeps the halves out of the way until a sentence asks for them', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: 'blir vi hjemme.' })).not.toBeInTheDocument();
    expect(slot('Hvis det regner i morgen,')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the halves under the sentence that was tapped, and closes them on a choice', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Hvis det regner i morgen,'));
    expect(slot('Hvis det regner i morgen,')).toHaveAttribute('aria-expanded', 'true');
    // Named after the sentence, so the group says which decision it belongs to.
    expect(
      screen.getByRole('group', {
        name: 'Halves that could complete: Hvis det regner i morgen,',
      }),
    ).toBeInTheDocument();

    await user.click(half('blir vi hjemme.'));

    expect(slot('Hvis det regner i morgen,')).toHaveAccessibleName(
      'Hvis det regner i morgen, — blir vi hjemme.',
    );
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('tapping the same sentence again puts the halves away', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(slot('Kari tar imot Bartek'));
    await user.click(slot('Kari tar imot Bartek'));

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('a locked slot opens nothing — there is no choice left to make there', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        results={{ p1: { correct: true, explanation: null } }}
        initialValue={{ p1: 'r1' }}
      />,
    );

    await user.click(slot('Kari tar imot Bartek'));

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

/** The engine as the hook would hand it over, with nothing playing yet. */
const engine = (over: Partial<ExerciseAudioEngine> = {}): ExerciseAudioEngine => ({
  audio: { ...AUDIO_DEFAULT, enabled: true, assetId: 'asset-1', title: 'Dialog', duration: 96 },
  segments: {},
  element: null,
  src: 'https://cdn.test/asset-1.mp3',
  state: { pos: 0, playing: false, plays: 0, completed: 0, range: null },
  duration: 96,
  playing: false,
  plays: 0,
  limit: 0,
  exhausted: false,
  heard: false,
  gated: false,
  canPlay: true,
  failed: false,
  loading: false,
  speed: 1,
  toggle: vi.fn(),
  back: vi.fn(),
  seekTo: vi.fn(),
  playRange: vi.fn(),
  cycleSpeed: vi.fn(),
  reset: vi.fn(),
  ...over,
});

/*
  The listening layer on this type (plan 56 phase 6): one clip for the exercise, with a
  timecode per pair. Audio on a single half is a different model and stays out (§2).
*/
describe('MatchPairsBody — with audio', () => {
  it('plays the clip above the pairs and offers each its own line', () => {
    renderWide(<Harness audio={engine({ segments: { p1: { start: 4, end: 12 } } })} />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /0:04/ })).toBeInTheDocument();
  });

  it('holds the pairs shut until the clip has been heard through once', () => {
    renderWide(<Harness audio={engine({ gated: true })} />);

    expect(
      screen.getByText('The pairs open once you have heard the clip through once.'),
    ).toBeInTheDocument();
  });

  it('is not there at all for an exercise without it', () => {
    renderWide(<Harness />);

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
