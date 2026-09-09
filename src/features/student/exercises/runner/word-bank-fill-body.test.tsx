import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { AUDIO_DEFAULT } from '@/lib/shared-kernel/audio';
import type { ExerciseAudioEngine } from '@/features/student/exercises/audio';

import { PRACTICE_ACCENT } from './types';
import {
  WordBankFillBody,
  keepCorrectBlanks,
  parseSentence,
  type WordBankFillContent,
  type WordBankFillValue,
} from './word-bank-fill-body';

const content: WordBankFillContent = {
  wordBank: ['show off', 'boast', 'clicked with'],
  items: [
    { id: '1', textWithBlanks: 'I hate it when people ___1___ all the time.' },
    { id: '2', textWithBlanks: 'I ___1___ her immediately and we ___2___ each other.' },
  ],
  instruction: 'Complete the sentences.',
};

/** The shared word bank above the sentences. */
const bank = () => screen.getByRole('group', { name: 'Word bank' });

function renderBody(props: Partial<React.ComponentProps<typeof WordBankFillBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordBankFillBody
        content={content}
        value={{}}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        ok={null}
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('parseSentence', () => {
  it('splits text around numbered blanks', () => {
    expect(parseSentence('a ___1___ b ___2___')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'blank', blankId: 1 },
      { kind: 'text', text: ' b ' },
      { kind: 'blank', blankId: 2 },
    ]);
  });

  it('returns the whole string when there is no blank', () => {
    expect(parseSentence('no blanks here')).toEqual([{ kind: 'text', text: 'no blanks here' }]);
  });
});

describe('WordBankFillBody', () => {
  it('renders a tappable blank per gap and one button per bank word', () => {
    renderBody();

    expect(screen.getAllByRole('button', { name: /Blank in sentence/ })).toHaveLength(3);
    expect(within(bank()).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('fills the blank the learner armed, not the first one', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(screen.getAllByRole('button', { name: /Blank in sentence/ })[2]!);
    fireEvent.click(within(bank()).getByRole('button', { name: /boast/ }));

    expect(onValueChange).toHaveBeenCalledWith({ '2': { 2: 'boast' } });
  });

  it('falls back to the first empty blank when none was armed', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(within(bank()).getByRole('button', { name: /boast/ }));

    expect(onValueChange).toHaveBeenCalledWith({ '1': { 1: 'boast' } });
  });

  it('takes a word back out when it is clicked again in the armed blank', () => {
    const onValueChange = vi.fn();
    renderBody({ value: { '1': { 1: 'boast' } }, onValueChange });

    fireEvent.click(screen.getAllByRole('button', { name: /Blank in sentence/ })[0]!);
    fireEvent.click(within(bank()).getByRole('button', { name: /boast/ }));

    expect(onValueChange).toHaveBeenCalledWith({ '1': { 1: '' } });
  });

  it('selects a bank word by its number key', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.keyDown(document.body, { key: '2' });

    expect(onValueChange).toHaveBeenCalledWith({ '1': { 1: 'boast' } });
  });

  it('enables submitting only once every blank is filled', () => {
    const onAnswerChange = vi.fn();
    const partial: WordBankFillValue = { '1': { 1: 'show off' } };
    const { rerender } = renderBody({ value: partial, onAnswerChange });

    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    // the helper line carries the prompt and the count together
    expect(screen.getByText(/1 of 3 blanks filled/)).toBeInTheDocument();
    expect(screen.getByText(/Tap a blank, then pick a word\./)).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WordBankFillBody
          content={content}
          value={{ '1': { 1: 'show off' }, '2': { 1: 'boast', 2: 'clicked with' } }}
          onValueChange={vi.fn()}
          onAnswerChange={onAnswerChange}
          phase="answering"
          ok={null}
          mode="practice"
          accent={PRACTICE_ACCENT}
        />
      </NextIntlClientProvider>,
    );

    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('keeps the accepted answer out of the sentence after a wrong pick', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off' } } },
    });

    // The pick is no longer editable…
    expect(screen.queryByRole('button', { name: /Blank in sentence/ })).not.toBeInTheDocument();
    // …and it stands alone: handing over the answer here would end the
    // exercise before the learner gets a second go (the bank above lists both
    // words, hence scoping to the sentence list).
    const sentence = screen.getByRole('list').textContent ?? '';
    expect(sentence).toContain('boast');
    expect(sentence).not.toContain('show off');
  });
});

describe('WordBankFillBody — select input mode', () => {
  const selectContent: WordBankFillContent = { ...content, inputMode: 'select' };

  it('puts the whole bank in a dropdown per blank and drops the bank strip', () => {
    renderBody({ content: selectContent });

    const selects = screen.getAllByRole('combobox', { name: /Blank in sentence/ });
    expect(selects).toHaveLength(3);
    // Three bank words plus the "Choose…" placeholder.
    expect(within(selects[0]!).getAllByRole('option')).toHaveLength(4);
    expect(screen.queryByRole('group', { name: 'Word bank' })).not.toBeInTheDocument();
    expect(screen.getByText(/Pick a word for each blank\./)).toBeInTheDocument();
  });

  it('records the picked word against its own blank', () => {
    const onValueChange = vi.fn();
    renderBody({ content: selectContent, onValueChange });

    fireEvent.change(screen.getAllByRole('combobox', { name: /Blank in sentence/ })[2]!, {
      target: { value: 'boast' },
    });

    expect(onValueChange).toHaveBeenCalledWith({ '2': { 2: 'boast' } });
  });

  it('ignores the number-key shortcuts, which belong to the bank strip', () => {
    const onValueChange = vi.fn();
    renderBody({ content: selectContent, onValueChange });

    fireEvent.keyDown(document.body, { key: '2' });

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

const RATIONALE = {
  explanation: 'A statement is introduced by «at».',
  options: [
    { text: 'show off', verdict: 'correct' as const, note: 'The set phrase.' },
    { text: 'boast', verdict: 'wrong' as const, note: 'Too formal here.' },
  ],
};

describe('keepCorrectBlanks', () => {
  it('keeps the blanks answered right and drops the misses', () => {
    const kept = keepCorrectBlanks(
      { '1': { 1: 'show off' }, '2': { 1: 'boast', 2: 'clicked with' } },
      {
        '1': { 1: { correct: true, expected: 'show off' } },
        '2': {
          1: { correct: false, expected: 'clicked with' },
          2: { correct: true, expected: 'clicked with' },
        },
      },
    );

    expect(kept).toEqual({ '1': { 1: 'show off' }, '2': { 2: 'clicked with' } });
  });

  it('drops a blank the grader never saw', () => {
    expect(keepCorrectBlanks({ '1': { 1: 'boast' } }, {})).toEqual({});
  });
});

describe('WordBankFillBody — revealed answers', () => {
  const revealProps = {
    phase: 'feedback' as const,
    ok: false,
    revealed: true,
    value: { '1': { 1: 'boast' } },
    results: { '1': { 1: { correct: false, expected: 'show off' } } },
  };

  it('puts the answer in the sentence with the miss struck out beside it', () => {
    renderBody(revealProps);

    const sentence = screen.getByRole('list');
    expect(within(sentence).getByText('show off')).toBeInTheDocument();
    expect(within(sentence).getByText('boast').tagName).toBe('S');
  });

  it('leaves the sentence alone while the answer is still withheld', () => {
    renderBody({ ...revealProps, revealed: false });

    const sentence = screen.getByRole('list');
    expect(within(sentence).getByText('boast').tagName).not.toBe('S');
    expect(sentence.textContent).not.toContain('show off');
  });
});

describe('WordBankFillBody — answer note markers', () => {
  /** The marker button sitting next to a checked blank. */
  const markers = () => screen.queryAllByRole('button', { name: /Why this answer/ });

  it('explains a missed blank without giving the answer away', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } } },
    });

    // The accepted answer is nowhere in the sentence list before opening…
    expect(screen.getByRole('list').textContent).not.toContain('show off');

    fireEvent.click(markers()[0]!);

    expect(screen.getByText(/Too formal here\./)).toBeInTheDocument();
    expect(screen.getByText('Your answer')).toBeInTheDocument();
    // …nor after: neither the answer nor the rule that names it
    expect(screen.queryByText(/The set phrase\./)).not.toBeInTheDocument();
    expect(screen.queryByText('A statement is introduced by «at».')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('closes the open note when another marker is opened', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' }, '2': { 1: 'boast', 2: 'boast' } },
      results: {
        '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } },
        '2': {
          1: { correct: false, expected: 'clicked with', rationale: RATIONALE },
          2: { correct: false, expected: 'show off', rationale: RATIONALE },
        },
      },
    });

    const [first, second] = markers();
    fireEvent.click(first!);
    expect(first).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(second!);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    // exactly one panel on screen at a time
    expect(screen.getAllByText(/Too formal here\./)).toHaveLength(1);
  });

  it('closes again on a second click', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } } },
    });

    const marker = markers()[0]!;
    expect(marker).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(marker);
    expect(marker).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(marker);
    expect(marker).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Too formal here\./)).not.toBeInTheDocument();
  });

  it('explains a correct blank too, without calling it out as the learner’s answer', () => {
    renderBody({
      phase: 'feedback',
      ok: true,
      value: { '1': { 1: 'show off' } },
      results: { '1': { 1: { correct: true, expected: 'show off', rationale: RATIONALE } } },
    });

    fireEvent.click(markers()[0]!);
    expect(screen.getByText('A statement is introduced by «at».')).toBeInTheDocument();
    expect(screen.getByText(/The set phrase\./)).toBeInTheDocument();
    expect(screen.queryByText('Your answer')).not.toBeInTheDocument();
  });

  it('prefers an exercise-level word note over the per-blank option note', () => {
    renderBody({
      content: { ...content, wordNotes: { boast: 'Bank-wide: too formal.' } },
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } } },
    });

    fireEvent.click(markers()[0]!);
    expect(screen.getByText(/Bank-wide: too formal\./)).toBeInTheDocument();
    expect(screen.queryByText(/Too formal here\./)).not.toBeInTheDocument();
  });

  it('shows no marker while answering, nor for a blank with nothing authored', () => {
    renderBody({
      phase: 'answering',
      ok: null,
      value: { '1': { 1: 'boast' } },
      results: { '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } } },
    });
    expect(markers()).toHaveLength(0);

    renderBody({
      phase: 'feedback',
      ok: false,
      value: { '1': { 1: 'clicked with' } },
      results: { '1': { 1: { correct: false, expected: 'show off', rationale: RATIONALE } } },
    });
    expect(markers()).toHaveLength(0);
  });
});

describe('WordBankFillBody — reusable words', () => {
  const picked: WordBankFillValue = { '1': { 1: 'show off' } };

  function bankWord(word: string) {
    // The bank chip lives in the labelled container above the sentence list.
    return within(screen.getByLabelText('Word bank')).getByText(word);
  }

  it('dims a spent word by default — one bank word per blank', () => {
    renderBody({ value: picked });
    expect(bankWord('show off').getAttribute('style')).toContain('opacity: 0.4');
  });

  it('keeps every word lit when the drill reuses them across blanks', () => {
    renderBody({ content: { ...content, reusableWords: true }, value: picked });
    expect(bankWord('show off').getAttribute('style')).toContain('opacity: 1');
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
  The listening layer on a template with no builder (plan 56 phase 6). It gets the runner
  half only, and that is not a gap: the layer is a property of the document, and a
  document written by a seed carries it as well as one written by a builder.
*/
describe('with audio', () => {
  it('plays the clip above the exercise', () => {
    renderBody({ audio: engine() });

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('locks the controls until the clip has been heard through once', () => {
    renderBody({ audio: engine({ gated: true }) });

    expect(
      screen.getByText('The gaps open once you have heard the clip through once.'),
    ).toBeInTheDocument();
  });

  it('is not there at all for an exercise without it', () => {
    renderBody();

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
