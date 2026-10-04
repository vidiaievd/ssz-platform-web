import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { AUDIO_DEFAULT } from '@/lib/shared-kernel/audio';
import type { SegmentState, StudentProjection, VerdictOp } from '@/lib/shared-kernel/dictation';
import type { ExerciseAudioEngine } from '@/features/student/exercises/audio';
import type { DictationSubmitDetails } from '@/features/student/exercises/types/attempts';

import { DictationBody, type DictationBodyProps } from './dictation-body';
import { DictationReaderCard } from './dictation-reader-card';
import { DiffLegend, DiffLine, DiffTally } from './diff-line';

const PROJECTION: StudentProjection = {
  instruction: 'Hør på opptaket og skriv setningene.',
  mode: 'segments',
  segments: [{ id: 's1' }, { id: 's2' }],
  settings: { attempts: 2, hints: true, revealKey: true, showWordCount: false },
};

/** «På kjøkkenet står det en skje.» written as «paa sjøkkenet står det en sje sje». */
const OPS: VerdictOp[] = [
  {
    k: 'sub',
    i: 0,
    n: 1,
    wrote: 'paa',
    expected: 'På',
    p: '',
    cls: 'diacritic',
    near: false,
    focus: false,
  },
  {
    k: 'sub',
    i: 1,
    n: 1,
    wrote: 'sjøkkenet',
    expected: 'kjøkkenet',
    p: '',
    cls: 'typo',
    near: false,
    focus: true,
    why: 'kj, not sj.',
  },
  { k: 'eq', i: 2, w: 'står', p: '' },
  { k: 'eq', i: 3, w: 'det', p: '' },
  {
    k: 'sub',
    i: 4,
    n: 1,
    wrote: 'em',
    expected: 'en',
    p: '',
    cls: 'typo',
    near: true,
    focus: false,
  },
  { k: 'del', i: 5, expected: 'skje', p: '.', focus: false },
  { k: 'ins', wrote: 'sje', p: '' },
];

const WORDS = { total: 6, exact: 2, near: 1, wrong: 2, missing: 1, extra: 1 };

const state = (segmentId: string, over: Partial<SegmentState> = {}): SegmentState => ({
  segmentId,
  checks: 0,
  firstScore: null,
  firstPassed: null,
  passed: false,
  revealed: false,
  closed: false,
  lastText: '',
  lastCheckAt: null,
  first: null,
  last: null,
  key: null,
  transcriptSlice: null,
  ...over,
});

function details(over: Partial<DictationSubmitDetails> = {}): DictationSubmitDetails {
  return {
    segmentId: 's1',
    pct: 33,
    passed: false,
    words: WORDS,
    ops: OPS,
    focus: [{ focusId: 'f1', word: 'kjøkkenet', why: 'kj, not sj.' }],
    why: 'Listen for the soft k.',
    attempt: 1,
    checksLeft: 1,
    closed: false,
    revealed: false,
    segments: [state('s1', { checks: 1, firstScore: 0.33, firstPassed: false }), state('s2')],
    complete: false,
    attemptPct: 17,
    attemptPassed: false,
    ...over,
  };
}

/** The engine as the hook would hand it over, with nothing playing yet. */
const engine = (over: Partial<ExerciseAudioEngine> = {}): ExerciseAudioEngine => ({
  audio: {
    ...AUDIO_DEFAULT,
    enabled: true,
    assetId: 'asset-1',
    title: 'Diktat',
    duration: 26,
    settings: { ...AUDIO_DEFAULT.settings, transcriptWhen: 'after' },
  },
  segments: { s1: { start: 0, end: 7 }, s2: { start: 7, end: 14 } },
  element: null,
  src: 'https://cdn.test/asset-1.mp3',
  state: { pos: 0, playing: false, plays: 0, completed: 0, range: null },
  duration: 26,
  playing: false,
  plays: 0,
  limit: 3,
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

function renderBody(props: Partial<DictationBodyProps> = {}) {
  const handlers = {
    onText: vi.fn(),
    onCheck: vi.fn(),
    onRetry: vi.fn(),
    onReveal: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DictationBody
        projection={PROJECTION}
        segmentIndex={0}
        states={[]}
        text=""
        verdict={null}
        attempt={1}
        accent="#0a7"
        layout="phone"
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, ...handlers };
}

const field = () => screen.getByRole('textbox', { name: 'Sentence 1' });

describe('DictationBody — writing', () => {
  it('disables Check while the field is empty (AC-R4), and enables it with text', () => {
    const { rerender } = renderBody();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DictationBody
          projection={PROJECTION}
          segmentIndex={0}
          states={[]}
          text="paa sjøkkenet"
          verdict={null}
          attempt={1}
          accent="#0a7"
          layout="phone"
          onText={vi.fn()}
          onCheck={vi.fn()}
          onRetry={vi.fn()}
          onReveal={vi.fn()}
          onNext={vi.fn()}
          onFinish={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    expect(screen.getByText('2 words')).toBeInTheDocument();
  });

  it('keeps Check resting for a moment after a check (Q4-A)', () => {
    renderBody({ text: 'paa', cooling: true });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('turns the keyboard’s corrections off on the field (AC-R11)', () => {
    renderBody();
    const f = field();
    expect(f).toHaveAttribute('autocorrect', 'off');
    expect(f).toHaveAttribute('autocapitalize', 'off');
    expect(f).toHaveAttribute('spellcheck', 'false');
    expect(f).toHaveAttribute('autocomplete', 'off');
    expect(f).toHaveAttribute('rows', '3');
  });

  it('passes what is typed to the solver', async () => {
    const { onText } = renderBody();
    await userEvent.type(field(), 'p');
    expect(onText).toHaveBeenCalledWith('p');
  });

  it('counts the words against the sentence only when the author shows the count', () => {
    renderBody({
      projection: {
        ...PROJECTION,
        segments: [
          { id: 's1', wordCount: 6 },
          { id: 's2', wordCount: 4 },
        ],
        settings: { ...PROJECTION.settings, showWordCount: true },
      },
      text: 'paa sjøkkenet',
    });
    expect(screen.getByText('2').closest('span')).toHaveTextContent('2 / 6 words');
  });

  it('names the field after the whole text, eight rows tall, in one-text mode', () => {
    renderBody({ projection: { ...PROJECTION, mode: 'whole', segments: [{ id: 's1' }] } });
    expect(screen.getByRole('textbox', { name: 'The whole text' })).toHaveAttribute('rows', '8');
  });

  it('draws the rail only for more than one sentence, in three states (plan 68 §4.2, 11)', () => {
    const { container } = renderBody({
      projection: { ...PROJECTION, segments: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      segmentIndex: 2,
      states: [
        state('s1', { checks: 1, passed: true, closed: true }),
        state('s2', { checks: 2, closed: true }),
      ],
    });
    const pips = [...container.querySelectorAll('i[data-s], i[aria-hidden]')].filter(
      (el) => el.tagName === 'I' && el.className.includes('h-1'),
    );
    expect(pips.map((p) => p.getAttribute('data-s'))).toEqual(['done', 'part', 'now']);
    expect(screen.getByText('Sentence 3 of 3')).toBeInTheDocument();
  });

  it('shows no corrected line and no verdict before a check', () => {
    renderBody({ text: 'paa' });
    expect(screen.queryByText('Corrected')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('DictationBody — the clip', () => {
  it('replays the sentence’s fragment from its timecode, which spends nothing (AC-R2)', async () => {
    const eng = engine();
    renderBody({ audio: eng });
    await userEvent.click(screen.getByRole('button', { name: /0:00.0:07/ }));
    expect(eng.playRange).toHaveBeenCalledWith(0, 7);
  });

  it('keeps the field usable when the listens are spent (AC-R1)', () => {
    renderBody({ audio: engine({ plays: 3, exhausted: true, canPlay: false }), text: 'paa' });
    expect(field()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('locks and labels the field until the clip has been heard once (AC-R5)', () => {
    renderBody({ audio: engine({ gated: true }), text: 'paa' });
    expect(field()).toBeDisabled();
    expect(field()).toHaveAttribute('placeholder', 'Listen to the clip first');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(
      screen.getByText('The field opens once you have heard the clip through once.'),
    ).toBeInTheDocument();
  });

  it('has no fragment in one-text mode', () => {
    renderBody({
      audio: engine(),
      projection: { ...PROJECTION, mode: 'whole', segments: [{ id: 's1' }] },
    });
    expect(screen.queryByRole('button', { name: /0:00.0:07/ })).toBeNull();
  });
});

describe('DictationBody — after a check', () => {
  it('locks the field and draws the corrected line, the tally and the score (AC-R6)', () => {
    renderBody({ text: 'paa sjøkkenet står det em sje', verdict: details() });

    expect(field()).toBeDisabled();
    const block = screen.getByText('Corrected').parentElement!;
    expect(within(block).getByText('33%')).toBeInTheDocument();
    expect(within(block).getByText('2 right')).toBeInTheDocument();
    expect(within(block).getByText('1 too many')).toBeInTheDocument();
  });

  it('states the count, the typo and its credit (BEHAVIOR §6)', () => {
    renderBody({ verdict: details() });
    expect(screen.getByText('2 of 6 words right — 1 typo.')).toBeInTheDocument();
  });

  it('says half credit only when the score shows it was given', () => {
    renderBody({ verdict: details({ pct: 42 }) });
    expect(screen.getByText('2 of 6 words right — 1 typo (half credit).')).toBeInTheDocument();
  });

  it('gives each wrong focus word its own line, and the reason under hints (AC-R7)', () => {
    renderBody({ verdict: details() });
    const focus = screen
      .getByText('kjøkkenet', { selector: '[data-tone] b' })
      .closest('[data-tone]')!;
    expect(focus).toHaveTextContent('kjøkkenet — kj, not sj.');
    expect(screen.getByText('Listen for the soft k.')).toBeInTheDocument();
  });

  it('falls back to a line of its own for a focus word without a reason', () => {
    renderBody({ verdict: details({ focus: [{ focusId: 'f1', word: 'kjøkkenet', why: '' }] }) });
    expect(
      screen.getByText('kjøkkenet', { selector: '[data-tone] b' }).closest('[data-tone]'),
    ).toHaveTextContent('This word is the point of the dictation.');
  });

  it('announces the count once, then «wrote X, correct Y» per deviation (AC-X11)', () => {
    renderBody({ verdict: details() });
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 of 6 words right — 1 typo. wrote paa, correct På wrote sjøkkenet, correct kjøkkenet ' +
        'wrote em, correct en missing skje extra sje',
    );
  });

  it('offers a retry and a reveal after a failed check, with the attempt line', async () => {
    const { onRetry, onReveal } = renderBody({ verdict: details() });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show the answer' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onReveal).toHaveBeenCalled();
    expect(screen.getByText('Attempt 1 of 2')).toBeInTheDocument();
  });

  it('keeps the typed text on screen for the retry (AC-R8)', () => {
    renderBody({ text: 'paa sjøkkenet', attempt: 2 });
    expect(field()).toHaveValue('paa sjøkkenet');
    expect(field()).toBeEnabled();
    expect(screen.getByText('Attempt 2 of 2')).toBeInTheDocument();
  });

  it('offers no retry once the sentence is out of checks, and moves on', () => {
    renderBody({ verdict: details({ attempt: 2, checksLeft: 0, closed: true }) });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show the answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next sentence' })).toBeInTheDocument();
  });

  it('has no reveal when the author turned it off', () => {
    renderBody({
      verdict: details(),
      projection: { ...PROJECTION, settings: { ...PROJECTION.settings, revealKey: false } },
    });
    expect(screen.queryByRole('button', { name: 'Show the answer' })).toBeNull();
  });

  it('after a pass: green, no retry, and Done on the last sentence (deviation 12)', async () => {
    const { onFinish } = renderBody({
      segmentIndex: 1,
      verdict: details({
        segmentId: 's2',
        pct: 100,
        passed: true,
        words: { total: 4, exact: 4, near: 0, wrong: 0, missing: 0, extra: 0 },
        ops: [],
        focus: [],
        why: undefined,
        closed: true,
      }),
      states: [state('s1', { closed: true }), state('s2', { passed: true, closed: true })],
    });
    expect(
      screen.getByText('Spelled correctly', { selector: '[data-tone] b' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onFinish).toHaveBeenCalled();
  });
});

describe('DictationBody — reveal (AC-R9)', () => {
  it('shows the sentence, keeps the last corrected line, and locks the sentence', () => {
    renderBody({
      verdict: details({
        ops: [],
        focus: [],
        why: undefined,
        revealed: true,
        closed: true,
        key: {
          text: 'På kjøkkenet står det en skje.',
          why: 'Listen for the soft k.',
          focus: [{ focusId: 'f1', word: 'kjøkkenet', why: 'kj, not sj.' }],
        },
      }),
      states: [
        state('s1', {
          checks: 1,
          revealed: true,
          closed: true,
          last: { pct: 33, words: WORDS, ops: OPS },
        }),
        state('s2'),
      ],
    });

    const key = screen.getByText('Answer').parentElement!;
    expect(key).toHaveTextContent('På kjøkkenet står det en skje.');
    expect(screen.getByText('Corrected')).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show the answer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next sentence' })).toBeInTheDocument();
    expect(screen.getByText('Listen for the soft k.')).toBeInTheDocument();
  });
});

describe('DictationBody — transcript drawer (plan 68 §3.6)', () => {
  it('holds only the slices of closed sentences, in order', async () => {
    renderBody({
      audio: engine(),
      segmentIndex: 1,
      states: [
        state('s1', {
          closed: true,
          passed: true,
          transcriptSlice: 'På kjøkkenet står det en skje.',
        }),
        state('s2'),
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: /Transcript/ }));
    expect(screen.getByText(/På kjøkkenet står det en skje\./)).toBeInTheDocument();
  });

  it('is absent before any sentence closed', () => {
    renderBody({ audio: engine() });
    expect(screen.queryByRole('button', { name: /Transcript/ })).toBeNull();
  });
});

describe('DictationBody — the summary (AC-R10)', () => {
  const done = {
    done: true,
    result: { pct: 66, passed: false },
    reasons: { s1: 'Listen for the soft k.' },
    states: [
      state('s1', {
        checks: 2,
        firstScore: 0.33,
        firstPassed: false,
        closed: true,
        last: { pct: 50, words: WORDS, ops: OPS },
      }),
      state('s2', {
        checks: 1,
        firstScore: 1,
        firstPassed: true,
        passed: true,
        closed: true,
        last: { pct: 100, words: WORDS, ops: [{ k: 'eq' as const, i: 0, w: 'Hun', p: '.' }] },
      }),
    ],
  };

  it('lists every sentence with its last corrected line, its first score and its reason', () => {
    renderBody(done);

    expect(screen.getByText('66%')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 sentences right')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // The record is the first check (AC-R8): 33, not the retry's 50.
    expect(within(rows[0]!).getByText('33%')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Listen for the soft k.')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('sjøkkenet')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('too many')).toBeInTheDocument();
  });

  it('keeps the player beside it on the desktop', () => {
    renderBody({ ...done, layout: 'desktop', audio: engine() });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});

describe('DictationBody — layouts', () => {
  it('puts the player, the list of sentences and the actions in a side column on desktop', () => {
    const { container } = renderBody({
      layout: 'desktop',
      title: 'Kjøkkenet',
      audio: engine(),
      states: [state('s1', { checks: 1, firstScore: 0.5 })],
      segmentIndex: 1,
    });
    expect(container.querySelector('[data-layout="desktop"]')).not.toBeNull();
    expect(screen.getByText('Kjøkkenet')).toBeInTheDocument();
    const list = screen.getAllByRole('listitem');
    expect(list[0]).toHaveTextContent('50%');
    expect(list[1]).toHaveTextContent('now');
    expect(list[1]).toHaveAttribute('aria-current', 'step');
  });

  it('shows an empty state when no sentence is ready', () => {
    renderBody({ projection: { ...PROJECTION, segments: [] } });
    expect(screen.getByText('Nothing to write yet')).toBeInTheDocument();
  });

  it('fills the body with the listen-first screen under a gate layout', () => {
    renderBody({
      audio: engine({
        audio: { ...engine().audio, settings: { ...engine().audio.settings, layout: 'gate' } },
      }),
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Diktat' })).toBeInTheDocument();
  });

  it.each(['phone', 'desktop'] as const)(
    'has no axe violations on the %s layout, before and after a check (AC-X11)',
    async (layout) => {
      const { container } = renderBody({ layout, audio: engine(), text: 'paa' });
      const before = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(before.violations).toEqual([]);

      const checked = renderBody({ layout, audio: engine(), verdict: details() });
      const after = await axe.run(checked.container, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(after.violations).toEqual([]);
    },
    20_000,
  );

  it('has no axe violations on the summary', async () => {
    const { container } = renderBody({
      done: true,
      result: { pct: 100, passed: true },
      states: [
        state('s1', {
          firstScore: 1,
          firstPassed: true,
          passed: true,
          closed: true,
          last: { pct: 100, words: WORDS, ops: OPS },
        }),
        state('s2', {
          firstScore: 1,
          firstPassed: true,
          passed: true,
          closed: true,
          last: { pct: 100, words: WORDS, ops: OPS },
        }),
      ],
    });
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe('DiffLine — one renderer (AC-X10, AC-R6)', () => {
  function line(ops: VerdictOp[], size?: 'sm') {
    return render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DiffLine ops={ops} {...(size === undefined ? {} : { size })} />
      </NextIntlClientProvider>,
    ).container;
  }

  it('marks every deviation with a shape as well as a colour', () => {
    const c = line(OPS);
    // A wrong word: what was written struck through, then the right word in bold.
    const sub = c.querySelector('[data-s="wrong"]')!;
    expect(sub.querySelector('s')).toHaveTextContent('paa');
    expect(sub.querySelector('b')).toHaveTextContent('På');
    expect(sub).toHaveAttribute('title', enMessages.ExerciseRunner.dictation.cls.diacritic);
    // A near miss is a near miss in colour only — the shape is the same.
    expect(c.querySelector('[data-s="near"] s')).toHaveTextContent('em');
    // A missing word is underlined, with its punctuation.
    const miss = c.querySelector('[data-s="miss"]') as HTMLElement;
    expect(miss).toHaveTextContent('skje.');
    expect(miss.style.boxShadow).toContain('inset');
    expect(miss).toHaveAttribute('title', 'Missing');
    // An extra word is struck through.
    const extra = c.querySelector('[data-s="extra"]') as HTMLElement;
    expect(extra.style.textDecoration).toBe('line-through');
    expect(extra).toHaveAttribute('title', 'Not in the recording');
  });

  it('names a focus word as the point of the dictation rather than its class', () => {
    const c = line(OPS);
    expect(c.querySelector('[data-focus="true"]')).toHaveAttribute(
      'title',
      'This word is the point of the dictation',
    );
  });

  it('reads one phrase per deviation, not two unrelated runs (AC-X11)', () => {
    const c = line(OPS);
    const spoken = [...c.querySelectorAll('.sr-only')].map((n) => n.textContent);
    expect(spoken).toEqual([
      'wrote paa, correct På',
      'wrote sjøkkenet, correct kjøkkenet',
      'wrote em, correct en',
      'missing skje',
      'extra sje',
    ]);
  });

  it('dims the punctuation of a right word, and sets the small size for the summary', () => {
    const c = line([{ k: 'eq', i: 0, w: 'Hun', p: ',' }], 'sm');
    expect(c.querySelector('i')).toHaveTextContent(',');
    expect(c.querySelector('p')).toHaveAttribute('data-size', 'sm');
  });

  it('tallies only the counts that are not zero; the legend names all five', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DiffTally words={{ total: 4, exact: 3, near: 0, wrong: 1, missing: 0, extra: 0 }} />
        <DiffLegend />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('3 right')).toBeInTheDocument();
    expect(screen.getByText('1 wrong')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ almost$/)).toBeNull();
    expect(container.querySelectorAll('[data-s]')).toHaveLength(2);
    for (const name of ['right', 'almost', 'wrong', 'missing', 'too many']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});

describe('DictationReaderCard (Q6-A)', () => {
  function card(over: Partial<Parameters<typeof DictationReaderCard>[0]> = {}) {
    const onStart = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DictationReaderCard
          title="Kjøkkenet"
          sentences={4}
          duration={26}
          plays={3}
          instruction="Hør på opptaket og skriv setningene."
          onStart={onStart}
          accent="#0a7"
          {...over}
        />
      </NextIntlClientProvider>,
    );
    return onStart;
  }

  it('says what is inside — never the text — and starts on the press', async () => {
    const onStart = card();
    expect(screen.getByText('Kjøkkenet')).toBeInTheDocument();
    expect(screen.getByText('4 sentences · 0:26 · 3 playbacks')).toBeInTheDocument();
    expect(screen.getByText('Orthography')).toBeInTheDocument();
    expect(screen.getByText('Hør på opptaket og skriv setningene.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Start the dictation/ }));
    expect(onStart).toHaveBeenCalled();
  });

  it('says unlimited playback with no limit, and names itself without a title', () => {
    card({ title: undefined, plays: 0, sentences: 1 });
    expect(screen.getByText('Dictation')).toBeInTheDocument();
    expect(screen.getByText('1 sentence · 0:26 · unlimited playback')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    card();
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
