import { useEffect, useRef } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { StudentProjection } from '@/lib/shared-kernel/minimal-pairs';
import type {
  MinimalPairsProbe,
  MinimalPairsProbeVerdict,
  MinimalPairsSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import { MinimalPairsBody } from './minimal-pairs-body';
import { createMockClipPlayer, type MockClipPlayer, useClipPlayer } from './minimal-pairs-clips';
import { MinimalPairsReaderCard } from './minimal-pairs-reader-card';
import { type SittingDriver, useMinimalPairsSitting } from './minimal-pairs-sitting';
import { MinimalPairsSummary } from './minimal-pairs-summary';

const PROJECTION: StudentProjection = {
  title: 'Hører du kj eller sj?',
  instruction: 'Trykk på ordet du hørte.',
  language: 'nb',
  contrast: { label: 'kj / sj', ipa: 'ç – ʃ' },
  set: { probes: 2, playsPerProbe: 2, autoplay: true },
  feedback: {
    immediate: true,
    abCompare: true,
    showSpelling: 'afterAnswer',
    showGloss: 'afterAnswer',
    showIpa: false,
    secondChance: false,
  },
};

const WORDS = {
  w1: { text: 'kjære', gloss: 'dear' },
  w2: { text: 'skjære', gloss: 'magpie' },
} as const;

interface EngineOptions {
  /** The word each probe plays. */
  keys?: Array<keyof typeof WORDS>;
  maxTries?: number;
  compare?: boolean;
  /** The probe the sitting resumes on, 0-based, with its first answer already given. */
  resumeAt?: { index: number; tries: number; closed: Array<{ n: number; correct: boolean }> };
  summary?: Partial<MinimalPairsSubmitDetails>;
  provenance?: 'tts' | 'studio';
  dialect?: string;
}

/** A sitting the way the engine plays it out: one probe at a time, the key only on closing. */
function fakeEngine(options: EngineOptions = {}) {
  const keys = options.keys ?? ['w2', 'w1'];
  const maxTries = options.maxTries ?? 1;
  let index = options.resumeAt?.index ?? 0;
  let tries = options.resumeAt?.tries ?? 0;
  const closed = [...(options.resumeAt?.closed ?? [])];
  let first: string | null = null;

  const probe = (): MinimalPairsProbe => ({
    n: index + 1,
    total: keys.length,
    questionId: `p${index + 1}`,
    clip: {
      url: `https://media.test/probe-${index + 1}.mp3`,
      expiresAt: '2026-10-09T12:00:00Z',
      durationMs: 700,
      provenance: options.provenance ?? 'studio',
      dialect: options.dialect ?? '',
    },
    options: [{ id: 'w1' }, { id: 'w2' }],
    state: { tries, maxTries, closed: false },
    closedProbes: [...closed],
  });

  const driver: SittingDriver = {
    next: vi.fn(async () => (index >= keys.length ? ('closed' as const) : probe())),
    answer: vi.fn(async (questionId: string, optionId: string) => {
      const key = keys[index]!;
      tries += 1;
      if (tries === 1) first = optionId;
      const correct = optionId === key;
      const isClosed = correct || tries >= maxTries;
      const verdict: MinimalPairsProbeVerdict = {
        questionId,
        n: index + 1,
        optionId,
        correct,
        closed: isClosed,
        tries,
        triesLeft: Math.max(0, maxTries - tries),
        firstCorrect: first === key,
      };
      if (isClosed) {
        verdict.keyOptionId = key;
        verdict.options = (['w1', 'w2'] as const).map((id) => ({ id, ...WORDS[id] }));
        if (!correct && options.compare !== false) {
          verdict.compare = {
            chosen: `https://media.test/${optionId}.mp3`,
            target: `https://media.test/${key}.mp3`,
          };
        }
        closed.push({ n: index + 1, correct: first === key });
        index += 1;
        tries = 0;
        first = null;
      }
      return verdict;
    }),
    finish: vi.fn(async () => ({
      right: closed.filter((c) => c.correct).length,
      total: keys.length,
      score: Math.round((closed.filter((c) => c.correct).length / keys.length) * 100),
      passed: closed.every((c) => c.correct),
      passPct: 75,
      memory: 'contrast' as const,
      pairs: [
        {
          pairId: 'pair1',
          words: ['kjære', 'skjære'],
          played: keys.length,
          correct: closed.filter((c) => c.correct).length,
          clips: ['https://media.test/w1.mp3', 'https://media.test/w2.mp3'],
        },
      ],
      ...options.summary,
    })),
  };
  return driver;
}

function Harness({
  projection,
  driver,
  player,
  onFinished,
}: {
  projection: StudentProjection;
  driver: SittingDriver;
  player: MockClipPlayer;
  onFinished?: (s: MinimalPairsSubmitDetails) => void;
}) {
  const clips = useClipPlayer(player);
  const sitting = useMinimalPairsSitting({
    driver,
    clips,
    playsPerProbe: projection.set.playsPerProbe,
    autoplay: projection.set.autoplay,
    ...(onFinished === undefined ? {} : { onFinished }),
  });
  const begun = useRef(false);
  const begin = sitting.begin;
  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    begin();
  }, [begin]);
  return (
    <MinimalPairsBody
      projection={projection}
      sitting={sitting}
      clips={clips}
      layout="desktop"
      onRestart={() => {}}
      accent="#000"
    />
  );
}

function renderSitting(
  options: EngineOptions & { projection?: Partial<StudentProjection> } = {},
  onFinished?: (s: MinimalPairsSubmitDetails) => void,
) {
  const projection = { ...PROJECTION, ...options.projection };
  const driver = fakeEngine(options);
  const player = createMockClipPlayer();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness
        projection={projection}
        driver={driver}
        player={player}
        {...(onFinished === undefined ? {} : { onFinished })}
      />
    </NextIntlClientProvider>,
  );
  return { driver, player };
}

const option = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const pips = () =>
  Array.from(document.querySelectorAll('[data-s]'))
    .filter((el) => el.tagName === 'I')
    .map((el) => el.getAttribute('data-s'));

describe('MinimalPairsBody — the probe', () => {
  it('plays the probe by itself, spending the first listen (MP-R4)', async () => {
    const { player } = renderSitting();
    await screen.findByText('2 of 2 plays left');

    await waitFor(() => expect(screen.getByText('1 of 2 plays left')).toBeInTheDocument());
    expect(player.requests[0]).toEqual([{ id: 'probe', url: 'https://media.test/probe-1.mp3' }]);
  });

  it('spends nothing when the browser refuses the autoplay (MP-R4)', async () => {
    const driver = fakeEngine();
    const player = createMockClipPlayer();
    player.refuseNext();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness projection={PROJECTION} driver={driver} player={player} />
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(player.requests).toHaveLength(1));
    expect(screen.getByText('2 of 2 plays left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play the word' })).toBeEnabled();
  });

  it('runs out of listens and keeps the button only as a pause (MP-R3)', async () => {
    const { player } = renderSitting({
      projection: { set: { ...PROJECTION.set, autoplay: false } },
    });
    const play = await screen.findByRole('button', { name: 'Play the word' });

    await userEvent.click(play);
    act(() => player.end());
    await userEvent.click(screen.getByRole('button', { name: 'Play the word' }));
    expect(await screen.findByText('No plays left')).toBeInTheDocument();

    // Still sounding: the button is a pause.
    const pause = screen.getByRole('button', { name: 'Pause' });
    expect(pause).toBeEnabled();
    await userEvent.click(pause);
    expect(screen.getByRole('button', { name: 'Play the word' })).toBeDisabled();
  });

  it('says listen freely when the budget is unlimited (MP-R3)', async () => {
    renderSitting({
      projection: { set: { ...PROJECTION.set, playsPerProbe: 0, autoplay: false } },
    });
    expect(await screen.findByText('Listen as often as you like')).toBeInTheDocument();
  });

  it('says a voice is synthetic, and names the dialect (MP-R5)', async () => {
    renderSitting({ provenance: 'tts', dialect: 'ost' });
    expect(await screen.findByText('synthetic voice')).toBeInTheDocument();
    expect(screen.getByText('østlandsk')).toBeInTheDocument();
  });

  it('letters the buttons while the spelling is hidden, and spells them once answered (MP-R6)', async () => {
    renderSitting({ projection: { set: { ...PROJECTION.set, autoplay: false } } });
    expect(await screen.findByRole('button', { name: /^A/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^B/ })).toBeInTheDocument();

    await userEvent.click(option('B'));
    expect(await screen.findByRole('button', { name: /^skjære/ })).toBeInTheDocument();
    // Meaning shown after the answer, on the button (MP-R7).
    expect(within(option('skjære')).getByText('magpie')).toBeInTheDocument();
  });

  it('marks the miss and the key, and plays chosen then heard by itself (MP-R8, MP-R9)', async () => {
    const { player } = renderSitting({
      projection: { set: { ...PROJECTION.set, autoplay: false } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /^A/ }));

    expect(await screen.findByText('It was «skjære».')).toBeInTheDocument();
    expect(option('kjære')).toHaveAttribute('data-s', 'wrong');
    expect(option('skjære')).toHaveAttribute('data-s', 'right');
    expect(screen.getByText('you chose')).toBeInTheDocument();
    expect(screen.getByText('you heard')).toBeInTheDocument();
    expect(screen.getByText('skjære — magpie')).toBeInTheDocument();

    await waitFor(() =>
      expect(player.requests.at(-1)).toEqual([
        { id: 'w1', url: 'https://media.test/w1.mp3' },
        { id: 'w2', url: 'https://media.test/w2.mp3' },
      ]),
    );

    const asked = player.requests.length;
    await userEvent.click(screen.getByRole('button', { name: 'Hear «kjære» and «skjære»' }));
    expect(player.requests).toHaveLength(asked + 1);
  });

  it('says only «correct» on a hit, with no comparison (MP-R8)', async () => {
    renderSitting({ projection: { set: { ...PROJECTION.set, autoplay: false } } });
    await userEvent.click(await screen.findByRole('button', { name: /^B/ }));

    expect(await screen.findByText('Correct.')).toBeInTheDocument();
    expect(option('kjære')).toHaveAttribute('data-s', 'dim');
    expect(screen.queryByText('you chose')).toBeNull();
  });

  it('gives a second chance with the clip again, free of the budget (MP-R10)', async () => {
    const { player } = renderSitting({
      maxTries: 2,
      projection: { set: { ...PROJECTION.set, autoplay: false } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /^A/ }));

    expect(
      await screen.findByText('Not quite. Listen once more and try again.'),
    ).toBeInTheDocument();
    expect(player.requests.at(-1)).toEqual([
      { id: 'probe', url: 'https://media.test/probe-1.mp3' },
    ]);
    expect(screen.getByText('2 of 2 plays left')).toBeInTheDocument();
    // No key yet: the buttons are still letters and still open.
    expect(screen.getByRole('button', { name: /^B/ })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /^B/ }));
    expect(await screen.findByText('Correct.')).toBeInTheDocument();
    // Right on the second try: the pip is the first answer's (MP-R1).
    expect(pips()[0]).toBe('bad');
  });

  it('shows only the marks when the verdict is not immediate (MP-R11)', async () => {
    renderSitting({
      projection: {
        set: { ...PROJECTION.set, autoplay: false },
        feedback: { ...PROJECTION.feedback, immediate: false },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /^A/ }));

    await waitFor(() => expect(option('kjære')).toHaveAttribute('data-s', 'wrong'));
    expect(screen.queryByText('It was «skjære».')).toBeNull();
  });

  it('keeps «Next» shut until answered, and ends on «See the result» (MP-R12, MP-R13)', async () => {
    const onFinished = vi.fn();
    renderSitting({ projection: { set: { ...PROJECTION.set, autoplay: false } } }, onFinished);
    const next = await screen.findByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /^B/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('2/2')).toBeInTheDocument();
    expect(pips()).toEqual(['ok', 'now']);

    await userEvent.click(screen.getByRole('button', { name: /^B/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'See the result' }));

    expect(await screen.findByTestId('mp-summary')).toBeInTheDocument();
    expect(screen.getByText('50% correct · the requirement is 75%')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('comes back on the probe it was on, pips and second chance intact (MP-R15)', async () => {
    renderSitting({
      keys: ['w2', 'w1', 'w2'],
      maxTries: 2,
      resumeAt: { index: 1, tries: 1, closed: [{ n: 1, correct: true }] },
    });
    expect(await screen.findByText('2/3')).toBeInTheDocument();
    // The third pip has no state yet and is not counted.
    expect(pips()).toEqual(['ok', 'now']);
    expect(screen.getByText('Not quite. Listen once more and try again.')).toBeInTheDocument();
  });

  it('goes straight to the result when every probe was answered before the reload', async () => {
    const { driver } = renderSitting({
      resumeAt: {
        index: 2,
        tries: 0,
        closed: [
          { n: 1, correct: true },
          { n: 2, correct: true },
        ],
      },
    });
    expect(await screen.findByTestId('mp-summary')).toBeInTheDocument();
    expect(driver.finish).toHaveBeenCalledTimes(1);
  });
});

const SUMMARY: MinimalPairsSubmitDetails = {
  right: 3,
  total: 4,
  score: 75,
  passed: true,
  passPct: 75,
  memory: 'contrast',
  pairs: [
    { pairId: 'a', words: ['kjære', 'skjære'], played: 2, correct: 1, clips: ['u1', 'u2'] },
    { pairId: 'b', words: ['kjekk', 'sjekk'], played: 2, correct: 2, clips: ['u3', 'u4'] },
  ],
};

function SummaryHarness(props: {
  summary: MinimalPairsSubmitDetails;
  player: MockClipPlayer;
  sittingsSpent?: number | null;
}) {
  const clips = useClipPlayer(props.player);
  return (
    <MinimalPairsSummary
      summary={props.summary}
      contrastLabel="kj / sj"
      clips={clips}
      onRestart={() => {}}
      sittingsSpent={props.sittingsSpent ?? null}
      accent="#000"
    />
  );
}

function renderSummary(summary: MinimalPairsSubmitDetails, sittingsSpent: number | null = null) {
  const player = createMockClipPlayer();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SummaryHarness summary={summary} player={player} sittingsSpent={sittingsSpent} />
    </NextIntlClientProvider>,
  );
  return player;
}

describe('MinimalPairsSummary (MP-R13, MP-R14)', () => {
  it('shows the tally, the verdict and the pair lines, and plays a pair in its order', async () => {
    const player = renderSummary(SUMMARY);
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('75% correct · the requirement is 75%')).toBeInTheDocument();
    expect(screen.getByText('kjære / skjære')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Hear the pair' })[0]!);
    expect(player.requests[0]).toEqual([
      { id: 'a:0', url: 'u1' },
      { id: 'a:1', url: 'u2' },
    ]);
  });

  it('says the words come back only when the words are rated (§4.2, point 6)', () => {
    renderSummary(SUMMARY);
    expect(screen.queryByText(/The words you missed/)).toBeNull();
    expect(screen.getByText(/has been added to your review\.$/)).toBeInTheDocument();
  });

  it('says so under contrast+word', () => {
    renderSummary({ ...SUMMARY, memory: 'contrast+word' });
    expect(
      screen.getByText(/The words you missed will come back on their own/),
    ).toBeInTheDocument();
  });

  it('says not in this exercise under none', () => {
    renderSummary({ ...SUMMARY, memory: 'none' });
    expect(screen.getByText(/but not in this exercise/)).toBeInTheDocument();
  });

  it('says the contrast is sitting when every pair was right', () => {
    renderSummary({ ...SUMMARY, pairs: SUMMARY.pairs.map((p) => ({ ...p, correct: p.played })) });
    expect(screen.getByText(/Every pair right/)).toBeInTheDocument();
  });

  it('puts «New round» away once the sittings are used (Q4-A)', () => {
    renderSummary(SUMMARY, 3);
    expect(screen.getByRole('button', { name: 'New round' })).toBeDisabled();
    expect(screen.getByText('You have used all 3 rounds.')).toBeInTheDocument();
  });
});

describe('MinimalPairsReaderCard (MP-R16)', () => {
  it('names the contrast, the probes, the minutes and how the listening works', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MinimalPairsReaderCard
          projection={{ ...PROJECTION, set: { ...PROJECTION.set, probes: 12 } }}
          onStart={() => {}}
          accent="#000"
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Hører du kj eller sj?')).toBeInTheDocument();
    expect(screen.getByText('kj / sj · 12 probes · about 3 min')).toBeInTheDocument();
    expect(
      screen.getByText(
        '2 plays per word · answer straight away · you hear the difference when you miss',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  });
});
