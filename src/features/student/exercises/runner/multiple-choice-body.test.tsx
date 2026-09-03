import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_SETTINGS,
  type ProjectedSettings,
  type StudentProjection,
} from '@/lib/shared-kernel/multiple-choice';
import type { MultipleChoiceResult } from '@/features/student/exercises/types/attempts';

import { AUDIO_DEFAULT, type ExerciseAudio } from '@/lib/shared-kernel/audio';
import type { ExerciseAudioEngine } from '@/features/student/exercises/audio';

import { MultipleChoiceBody, type MultipleChoicePhase } from './multiple-choice-body';

type SetOverrides = Partial<Omit<StudentProjection, 'settings'>> & {
  settings?: Partial<ProjectedSettings>;
};

function makeSet(overrides: SetOverrides = {}): StudentProjection {
  const { settings, ...rest } = overrides;
  return {
    instruction: 'Velg formen som passer.',
    questions: [
      {
        id: 'q1',
        kind: 'grammar',
        stem: 'Han sa at han ___ syk.',
        options: [
          { id: 'a', text: 'er' },
          { id: 'b', text: 'var' },
          { id: 'c', text: 'har vært' },
        ],
      },
      {
        id: 'q2',
        kind: 'reading',
        stem: 'Overtid er vanlig i Norge.',
        options: [
          { id: 'r', text: 'Riktig' },
          { id: 'g', text: 'Galt' },
        ],
      },
    ],
    settings: {
      letters: DEFAULT_SETTINGS.letters,
      layout: DEFAULT_SETTINGS.layout,
      instant: DEFAULT_SETTINGS.instant,
      retry: DEFAULT_SETTINGS.retry,
      eliminate: DEFAULT_SETTINGS.eliminate,
      progress: DEFAULT_SETTINGS.progress,
      ...settings,
    },
    ...rest,
  };
}

function makeResult(overrides: Partial<MultipleChoiceResult> = {}): MultipleChoiceResult {
  return {
    questionId: 'q1',
    optionId: 'a',
    correct: false,
    attempt: 1,
    attemptsLeft: 1,
    closed: false,
    ...overrides,
  };
}

interface Props {
  set?: StudentProjection;
  audio?: ExerciseAudioEngine;
  index?: number;
  picked?: string | null;
  phase?: MultipleChoicePhase;
  result?: MultipleChoiceResult | null;
  attempt?: number;
  eliminated?: string[];
  score?: number;
  onPick?: () => void;
  onCheck?: () => void;
  onRetry?: () => void;
  onReveal?: () => void;
  onNext?: () => void;
  onRestart?: () => void;
}

function renderBody(props: Props = {}): ReactElement {
  const element = (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MultipleChoiceBody
        set={props.set ?? makeSet()}
        index={props.index ?? 0}
        picked={props.picked ?? null}
        onPick={props.onPick ?? vi.fn()}
        phase={props.phase ?? 'picking'}
        result={props.result ?? null}
        attempt={props.attempt ?? 1}
        {...(props.eliminated ? { eliminated: props.eliminated } : {})}
        score={props.score ?? 0}
        {...(props.audio ? { audio: props.audio } : {})}
        onCheck={props.onCheck ?? vi.fn()}
        onRetry={props.onRetry ?? vi.fn()}
        onReveal={props.onReveal ?? vi.fn()}
        onNext={props.onNext ?? vi.fn()}
        onRestart={props.onRestart ?? vi.fn()}
        accent="#000"
      />
    </NextIntlClientProvider>
  );
  render(element);
  return element;
}

/** The accessible name is the option text alone — the letter badge is `aria-hidden`. */
const option = (text: string) => screen.getByRole('button', { name: text });

describe('MultipleChoiceBody', () => {
  // BEHAVIOR.md, "Student runner — decision table", row by row.

  it('nothing picked: Check is disabled', () => {
    renderBody();

    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(option('er')).toHaveAttribute('aria-pressed', 'false');
  });

  it('picked but not judged: Check is enabled and the pick is pressed', () => {
    renderBody({ picked: 'a' });

    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    expect(option('er')).toHaveAttribute('aria-pressed', 'true');
  });

  it('under instant there is no Check button at all, only the hint', () => {
    renderBody({ set: makeSet({ settings: { instant: true } }), picked: 'a' });

    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(screen.getByText('Tap an answer')).toBeInTheDocument();
  });

  it('right: says so, shows the rule, and offers the next question', () => {
    renderBody({
      picked: 'b',
      phase: 'judged',
      result: makeResult({
        optionId: 'b',
        correct: true,
        closed: true,
        keyOptionId: 'b',
        why: 'Presens flyttes til preteritum.',
      }),
    });

    expect(screen.getByText('Correct.')).toBeInTheDocument();
    expect(screen.getByText('Presens flyttes til preteritum.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next question/ })).toBeInTheDocument();
    expect(screen.getByText('Attempt 1')).toBeInTheDocument();
  });

  /**
   * The rule the whole design turns on: while a try remains, the key is not on the
   * screen. It cannot be — the server did not send it — and this asserts the runner does
   * not invent it from anything else it holds.
   */
  it('wrong with a try left: the key is nowhere, and both buttons are offered', () => {
    renderBody({
      picked: 'a',
      phase: 'judged',
      result: makeResult({ optionWhy: '«er» er presens.' }),
    });

    expect(screen.getByText('«er» er presens.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the answer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next question/ })).toBeNull();
    // Every option is still pressable — none of them is marked as the answer.
    for (const text of ['er', 'var', 'har vært']) {
      expect(option(text)).toBeEnabled();
    }
  });

  it('wrong with nothing written against the option: the generic line stands in', () => {
    renderBody({ picked: 'a', phase: 'judged', result: makeResult() });

    expect(screen.getByText('Not right. Look at the sentence again.')).toBeInTheDocument();
  });

  it('closed after a miss: the key is shown, the options are dead, the rule is there', () => {
    renderBody({
      picked: 'a',
      phase: 'judged',
      attempt: 2,
      result: makeResult({
        attempt: 2,
        attemptsLeft: 0,
        closed: true,
        keyOptionId: 'b',
        optionWhy: '«er» er presens.',
        why: 'Presens flyttes til preteritum.',
      }),
    });

    expect(screen.getByText('«er» er presens.')).toBeInTheDocument();
    expect(screen.getByText('Presens flyttes til preteritum.')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect(option('var')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
  });

  it('the 50/50 dims its options, strikes them through and disables them', () => {
    // Struck through as well as dimmed: colour is never the only signal (README, a11y).
    renderBody({
      set: makeSet({ settings: { eliminate: true } }),
      picked: 'a',
      phase: 'judged',
      result: makeResult({ eliminated: ['a', 'c'] }),
      eliminated: ['a', 'c'],
    });

    expect(option('har vært')).toBeDisabled();
    expect(option('har vært')).toHaveStyle({ textDecoration: 'line-through' });
    // The one distractor the 50/50 spared is still playable.
    expect(option('var')).toBeEnabled();
  });

  it('the last question finishes rather than moving on', () => {
    renderBody({
      index: 1,
      picked: 'g',
      phase: 'judged',
      result: makeResult({ questionId: 'q2', optionId: 'g', correct: true, closed: true }),
    });

    expect(screen.getByRole('button', { name: /Finish/ })).toBeInTheDocument();
  });

  it('tapping an option reports it', async () => {
    const onPick = vi.fn();
    renderBody({ onPick });

    await userEvent.click(option('var'));

    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('the completion card reports the first-attempt score and offers a restart', () => {
    renderBody({ phase: 'done', score: 1 });

    expect(screen.getByText('1 of 2 right on the first attempt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start over/ })).toBeInTheDocument();
  });

  it('a set with nothing answerable says what a question needs', () => {
    renderBody({ set: makeSet({ questions: [] }) });

    expect(screen.getByText('Nothing to answer yet')).toBeInTheDocument();
  });

  it('shows the passage the server sent', () => {
    renderBody({
      set: makeSet({
        questions: [
          {
            id: 'q1',
            kind: 'reading',
            stem: 'Hva er riktig?',
            context: 'Bartek har jobbet som elektriker i tre år.',
            options: [
              { id: 'a', text: 'Ett år' },
              { id: 'b', text: 'Tre år' },
            ],
          },
        ],
      }),
    });

    expect(screen.getByText('Bartek har jobbet som elektriker i tre år.')).toBeInTheDocument();
  });

  /*
    The listening layer mounted on this type (plan 56, INTEGRATION.md). What matters here
    is not the player — that has its own tests — but the two rules the integration recipe
    is emphatic about: the gate has to reach *every* control the type owns, and an
    exercise without audio has to be exactly what it was before the layer existed.
  */
  describe('with audio', () => {
    type AudioOverrides = Partial<Omit<ExerciseAudio, 'settings'>> & {
      settings?: Partial<ExerciseAudio['settings']>;
    };

    const audioBlock = (over: AudioOverrides = {}): ExerciseAudio => ({
      ...AUDIO_DEFAULT,
      enabled: true,
      assetId: 'asset-1',
      title: 'Dialog: på legekontoret',
      duration: 96,
      ...over,
      settings: { ...AUDIO_DEFAULT.settings, ...over.settings },
    });

    const engine = (over: Partial<ExerciseAudioEngine> = {}): ExerciseAudioEngine => ({
      audio: audioBlock(),
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

    it('puts a player above the questions', () => {
      renderBody({ audio: engine() });

      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
      expect(screen.getByText('Dialog: på legekontoret')).toBeInTheDocument();
      // The question is still there: the player is above the items, not instead of them.
      expect(screen.getByText('Han sa at han ___ syk.')).toBeInTheDocument();
    });

    it('locks every control the type owns until the clip has been heard', () => {
      renderBody({
        audio: engine({ audio: audioBlock({ settings: { gate: 'first' } }), gated: true }),
        picked: 'a',
      });

      for (const option of ['er', 'var', 'har vært']) {
        expect(screen.getByRole('button', { name: new RegExp(option) })).toBeDisabled();
      }
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(
        screen.getByText('The questions open once you have heard the clip through once.'),
      ).toBeInTheDocument();
    });

    it('unlocks them once it has', () => {
      renderBody({
        audio: engine({ audio: audioBlock({ settings: { gate: 'first' } }), heard: true }),
        picked: 'a',
      });

      expect(screen.getByRole('button', { name: /er/ })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    });

    it('fills the runner with the listen-first screen under the gate layout', () => {
      renderBody({
        audio: engine({ audio: audioBlock({ settings: { layout: 'gate', gate: 'first' } }), gated: true }),
      });

      expect(screen.getByRole('button', { name: 'Listen first' })).toBeDisabled();
      // No items at all until the way through is taken.
      expect(screen.queryByText('Han sa at han ___ syk.')).not.toBeInTheDocument();
    });

    it('offers the fragment of the question on screen, and only that one', () => {
      const eng = engine({
        audio: audioBlock({ useSegments: true }),
        segments: { q1: { start: 22, end: 48 }, q2: { start: 60, end: 80 } },
      });
      renderBody({ audio: eng, index: 0 });
      expect(screen.getByRole('button', { name: /0:22–0:48/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /1:00–1:20/ })).not.toBeInTheDocument();
      cleanup();

      renderBody({ audio: eng, index: 1 });
      expect(screen.getByRole('button', { name: /1:00–1:20/ })).toBeInTheDocument();
    });

    it('is not there at all for an exercise without it', () => {
      renderBody();

      expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Transcript' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /er/ })).toBeEnabled();
    });
  });

});
