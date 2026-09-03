import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { AUDIO_DEFAULT } from '@/lib/shared-kernel/audio';
import type { ExerciseAudioEngine } from '@/features/student/exercises/audio';
import {
  DEFAULT_SETTINGS,
  type Placement,
  type ProjectedRow,
  type Settings,
  type StudentResult,
} from '@/lib/shared-kernel/sentence-schema';

import { SentenceSchemaBody, type SentenceSchemaPhase } from './sentence-schema-body';

/**
 * One sentence as the server projects it: fields, a shuffled bank, and the sentence to
 * rewrite. Nothing here says where a piece goes — that is the point of the type.
 *
 * `f-adv` is optional and `f-slutt` is not, which is what the two empty-cell rules are
 * about: an optional empty field draws `—`, a required one draws nothing, so its
 * emptiness cannot be read as a clue.
 */
function makeRow(overrides: Partial<ProjectedRow> = {}): ProjectedRow {
  return {
    id: 'r1',
    clause: 'sub',
    fields: [
      {
        id: 'f-sub',
        short: 'sub',
        label: 'Subjunksjon',
        hint: 'at, om eller spørreordet',
        optional: false,
      },
      { id: 'f-adv', short: 'a', label: 'Adverbial', hint: '', optional: true },
      { id: 'f-v', short: 'v', label: 'Verbal', hint: '', optional: false },
      { id: 'f-slutt', short: 'N', label: 'Sluttfelt', hint: '', optional: false },
    ],
    bank: [
      { id: 'c1', text: 'at' },
      { id: 'c2', text: 'ikke' },
      { id: 'c3', text: 'kommer' },
      { id: 'x1', text: 'har' },
    ],
    source: '«Jeg kommer ikke», sa han.',
    counts: null,
    start: {},
    ...overrides,
  };
}

function makeResult(overrides: Partial<StudentResult> = {}): StudentResult {
  return {
    rowId: 'r1',
    attempt: 1,
    byItem: { c1: 'ok', c2: 'field' },
    byField: { 'f-sub': 'ok', 'f-adv': 'bad', 'f-v': 'empty', 'f-slutt': 'empty' },
    wrong: 1,
    solved: false,
    score: 25,
    why: null,
    text: null,
    solution: null,
    banner: { source: 'override', text: 'Her står ikke foran verbet.', code: null, hint: '' },
    ...overrides,
  };
}

function Harness({
  row = makeRow(),
  settings = DEFAULT_SETTINGS,
  phase = 'placing' as SentenceSchemaPhase,
  result = null,
  attempt = 1,
  initial = {},
  onCheck = vi.fn(),
  onRetry = vi.fn(),
  onReveal = vi.fn(),
  onNext = vi.fn(),
  onRestart = vi.fn(),
  audio,
}: {
  row?: ProjectedRow;
  audio?: ExerciseAudioEngine;
  settings?: Settings;
  phase?: SentenceSchemaPhase;
  result?: StudentResult | null;
  attempt?: number;
  initial?: Placement;
  onCheck?: () => void;
  onRetry?: () => void;
  onReveal?: () => void;
  onNext?: () => void;
  onRestart?: () => void;
}): ReactElement {
  const [placement, setPlacement] = useState<Placement>(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SentenceSchemaBody
        row={row}
        settings={settings}
        index={0}
        total={2}
        placement={placement}
        onPlacementChange={setPlacement}
        phase={phase}
        attempt={attempt}
        result={result}
        tally={{ solved: 1, revealed: 0, skipped: 0 }}
        onCheck={onCheck}
        onRetry={onRetry}
        onReveal={onReveal}
        onNext={onNext}
        onRestart={onRestart}
        {...(audio === undefined ? {} : { audio })}
        accent="var(--ssz-runner-practice)"
      />
    </NextIntlClientProvider>
  );
}

const field = (name: string) => screen.getByRole('button', { name: `Place in ${name}` });
const piece = (text: string) => screen.getByRole('button', { name: text });

describe('SentenceSchemaBody', () => {
  it('places a piece by tapping the piece and then the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(piece('at'));
    await user.click(field('Subjunksjon'));

    expect(field('Subjunksjon')).toHaveTextContent('at');
  });

  it('places a piece by tapping the field first — the same path in reverse', async () => {
    // BEHAVIOR, "Student · placing": both directions, and no mode switch between them.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field('Verbal'));
    await user.click(piece('kommer'));

    expect(field('Verbal')).toHaveTextContent('kommer');
  });

  it('answers Enter and Space on a field, so the board is solvable without a pointer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(piece('at'));
    field('Subjunksjon').focus();
    await user.keyboard('{Enter}');

    expect(field('Subjunksjon')).toHaveTextContent('at');
  });

  it('takes a placed piece back when its own × is pressed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ 'f-sub': ['c1'] }} />);

    await user.click(screen.getByRole('button', { name: 'Take «at» back' }));

    expect(field('Subjunksjon')).not.toHaveTextContent('at');
  });

  it('takes a placed piece back when it is tapped in the bank, where it still sits', async () => {
    // A used piece stays in the bank at low opacity rather than leaving it: a bank that
    // reflows on every placement destroys the learner's spatial memory mid-sentence.
    const user = userEvent.setup();
    render(<Harness initial={{ 'f-sub': ['c1'] }} />);

    expect(piece('at')).toBeInTheDocument();
    await user.click(piece('at'));

    expect(field('Subjunksjon')).not.toHaveTextContent('at');
  });

  it('moves a piece from one field to another without leaving a copy behind', async () => {
    // Aim first, then tap: the precise path, unchanged by the shortcut below.
    const user = userEvent.setup();
    render(<Harness initial={{ 'f-sub': ['c1'] }} />);

    await user.click(piece('at'));
    await user.click(field('Verbal'));
    await user.click(piece('at'));

    expect(field('Subjunksjon')).not.toHaveTextContent('at');
    expect(field('Verbal')).toHaveTextContent('at');
  });

  it('puts an unaimed tap straight into the first empty field', async () => {
    // The gesture `word_bank_gap_fill` has used since plan 35: a word goes to the armed
    // slot, or to the first empty one. Aiming twice for every piece is aiming at what the
    // board already makes obvious.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(piece('at'));

    expect(field('Subjunksjon')).toHaveTextContent('at');
  });

  it('points at where the next tap will land, so a run of taps fills the board in order', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(piece('at'));
    await user.click(piece('ikke'));
    await user.click(piece('kommer'));

    // Board order is sub · a · v · N, and three taps filled the first three of them.
    expect(field('Subjunksjon')).toHaveTextContent('at');
    expect(field('Adverbial')).toHaveTextContent('ikke');
    expect(field('Verbal')).toHaveTextContent('kommer');
  });

  it('falls back to selecting once every field holds something', async () => {
    // Nothing is obviously next, so the piece waits for the learner to name a field —
    // which is what lets two pieces share one.
    const user = userEvent.setup();
    // Two fields, three pieces — the normal shape of a real sentence, where the bank
    // outlasts the board. With both fields holding something, a free piece has nowhere
    // obvious to go, so the tap selects and the learner names the field.
    const narrow = {
      ...makeRow(),
      fields: makeRow().fields.slice(0, 2),
    };
    render(<Harness row={narrow} initial={{ 'f-sub': ['c1'], 'f-adv': ['c2'] }} />);

    await user.click(piece('kommer'));
    await user.click(field('Adverbial'));

    expect(field('Adverbial')).toHaveTextContent('kommer');
  });

  it('shows the sentence to rewrite and never the sentence being built', () => {
    render(<Harness />);

    expect(screen.getByText('«Jeg kommer ikke», sa han.')).toBeInTheDocument();
    expect(screen.queryByText(/at han ikke kommer/)).not.toBeInTheDocument();
  });

  it('counts what is placed on the Check button, and refuses an empty board', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Harness onCheck={onCheck} />);

    expect(screen.getByRole('button', { name: 'Check (0/4)' })).toBeDisabled();

    await user.click(piece('at'));
    await user.click(field('Subjunksjon'));
    await user.click(screen.getByRole('button', { name: 'Check (1/4)' }));

    expect(onCheck).toHaveBeenCalled();
  });

  it('shows the author’s own note for the piece that went wrong', () => {
    // The chain runs over the answer key, so the note arrives resolved from the server.
    render(<Harness phase="checked" result={makeResult()} initial={{ 'f-adv': ['c2'] }} />);

    expect(screen.getByText('Her står ikke foran verbet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fix (1)' })).toBeInTheDocument();
  });

  it('renders a default note as copy rather than as the code it arrived as', () => {
    render(
      <Harness
        phase="checked"
        result={makeResult({
          banner: { source: 'default', text: '', code: 'order', hint: '' },
        })}
      />,
    );

    expect(screen.getByText('Right field, wrong order inside it.')).toBeInTheDocument();
  });

  it('repeats the rule under the note from the second attempt on', () => {
    render(
      <Harness
        attempt={2}
        phase="checked"
        result={makeResult({
          attempt: 2,
          banner: {
            source: 'override',
            text: 'Her står ikke foran verbet.',
            code: null,
            hint: 'I en leddsetning står ikke foran verbet.',
          },
        })}
      />,
    );

    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect(screen.getByText('I en leddsetning står ikke foran verbet.')).toBeInTheDocument();
  });

  it('drops the marks as soon as the board is edited again', async () => {
    // Transient by design: a marked board that is then edited is a board whose marks are
    // about something else. The body reports the edit; the runner clears the phase.
    const user = userEvent.setup();
    const marked = makeResult();
    render(<Harness phase="checked" result={marked} initial={{ 'f-adv': ['c2'] }} />);

    expect(screen.getByText('Her står ikke foran verbet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Take «ikke» back' }));

    // Still `checked` here — only the solver can change the phase — but the piece is off
    // the board, which is the edit the runner acts on.
    expect(field('Adverbial')).not.toHaveTextContent('ikke');
  });

  it('locks the board and hides the bank once the sentence is closed', () => {
    render(
      <Harness
        phase="closed"
        result={makeResult({
          solved: true,
          byItem: { c1: 'ok', c2: 'ok', c3: 'ok' },
          wrong: 0,
          score: 100,
          why: 'I en leddsetning står ikke foran verbet.',
          text: 'at han ikke kommer',
          banner: {
            source: 'why',
            text: 'I en leddsetning står ikke foran verbet.',
            code: null,
            hint: '',
          },
        })}
        initial={{ 'f-sub': ['c1'], 'f-adv': ['c2'], 'f-v': ['c3'] }}
      />,
    );

    // The sentence itself arrives with the verdict, and only then.
    expect(screen.getByText('at han ikke kommer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check (3/4)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next sentence' })).toBeInTheDocument();
    // A locked board is a picture, not a control being refused: the cells stop being
    // drop targets and the bank is gone, so there is nothing left to press.
    expect(screen.queryByRole('button', { name: 'Place in Subjunksjon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'at' })).not.toBeInTheDocument();
  });

  it('offers to show the schema while the sentence is open, and not after', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Show the correct schema' })).toBeInTheDocument();
  });

  it('marks an optional empty field with a dash and a required one with nothing', () => {
    render(<Harness />);

    // `f-adv` is optional, `f-slutt` is not. The second is deliberately silent: an empty
    // required field must not hint that something belongs there.
    expect(field('Adverbial')).toHaveTextContent('—');
    expect(field('Sluttfelt')).toHaveTextContent('');
  });

  it('hides where the mistake is when the author turned per-field marking off, and keeps the verdict', () => {
    render(
      <Harness
        settings={{ ...DEFAULT_SETTINGS, perField: false }}
        phase="checked"
        result={makeResult()}
        initial={{ 'f-adv': ['c2'] }}
      />,
    );

    // The note still appears — §6.8: hiding where the mistake is must not hide that
    // there is one.
    expect(screen.getByText('Her står ikke foran verbet.')).toBeInTheDocument();
  });

  it('shows the field hints only when the author turned them on', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByText('at, om eller spørreordet')).not.toBeInTheDocument();
    unmount();

    render(<Harness settings={{ ...DEFAULT_SETTINGS, hints: true }} />);
    expect(screen.getByText('at, om eller spørreordet')).toBeInTheDocument();
  });

  it('shows the completion card with a replay, and no navigation of its own', () => {
    render(<Harness phase="done" />);

    expect(screen.getByText('All 2 sentences done')).toBeInTheDocument();
    expect(screen.getByText('1 solved · 0 shown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do it again' })).toBeInTheDocument();
    // Plan 52 §5: the player owns navigation, so the card offers no "next exercise".
    expect(screen.queryByRole('button', { name: /next exercise/i })).not.toBeInTheDocument();
  });
});

/** The engine as the hook would hand it over, with nothing playing yet. */
const engine = (over: Partial<ExerciseAudioEngine> = {}): ExerciseAudioEngine => ({
  audio: { ...AUDIO_DEFAULT, enabled: true, assetId: 'asset-1', title: 'Diktat', duration: 96 },
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
  The listening layer on this type (plan 56 phase 6). One clip for the set with a fragment
  per sentence — the player is above the board and survives the walk from one sentence to
  the next, because the allowance belongs to the exercise.
*/
describe('SentenceSchemaBody — with audio', () => {
  it('plays the clip above the board and offers this sentence its own line', () => {
    render(<Harness audio={engine({ segments: { r1: { start: 4, end: 12 } } })} />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /0:04/ })).toBeInTheDocument();
  });

  it('holds the board shut until the clip has been heard through once', () => {
    render(<Harness audio={engine({ gated: true })} />);

    expect(
      screen.getByText('The pieces open once you have heard the clip through once.'),
    ).toBeInTheDocument();
  });

  it('is not there at all for an exercise without it', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
