import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  emptyProsodyLayer,
  type ProsodyLayer,
  type SoundSeg,
  type WordSounds,
} from '@/lib/shared-kernel/prosody';

import { ProsodyControls } from './prosody-controls';
import { ProsodyLegend } from './prosody-legend';
import { ProsodyText } from './prosody-text';
import { createMockRecorder } from '@/features/student/exercises/recorder';

import { SentenceDrill } from './sentence-drill';
import { answerOf, type SentenceAnswer } from './sentence-recording';

const TEXT = 'Jeg heter Anna, og jeg snakker norsk.';

function layer(): ProsodyLayer {
  const l = emptyProsodyLayer();
  l.stresses = [
    { i: 1, w: 'heter', toneme: 2, vowel: { s: 1, e: 2, long: true }, source: 'lexicon' },
    { i: 2, w: 'Anna', toneme: 2, vowel: { s: 0, e: 1, long: false }, source: 'lexicon' },
    { i: 6, w: 'norsk', toneme: null, vowel: { s: 1, e: 2, long: false }, source: 'lexicon' },
  ];
  l.accents = [{ i: 2, w: 'Anna', source: 'teacher' }];
  l.boundaries = [{ i: 2, w: 'Anna', pitch: 'rise', pause: 'short', source: 'teacher' }];
  l.links = [{ i: 3, w: 'og jeg', source: 'teacher' }];
  return l;
}

const seg = (s: number, e: number, patch: Partial<SoundSeg>): SoundSeg => ({
  s,
  e,
  kind: 'consonant',
  sounds: [],
  stress: null,
  long: null,
  tie: false,
  ...patch,
});

// snakker → S N AH2 K AX0 R; the lexicon's letters over its sounds.
const SNAKKER: SoundSeg[] = [
  seg(0, 1, { sounds: ['S'] }),
  seg(1, 2, { sounds: ['N'] }),
  seg(2, 3, { kind: 'vowel', sounds: ['AH'], stress: 2, long: false }),
  seg(3, 5, { sounds: ['K'] }),
  seg(5, 6, { kind: 'vowel', sounds: ['AX'], stress: 0, long: false }),
  seg(6, 7, { sounds: ['R'] }),
];
// tunge → toŋe, with the silent-free tie ng.
const TUNGE: SoundSeg[] = [
  seg(0, 1, { sounds: ['T'] }),
  seg(1, 2, { kind: 'vowel', sounds: ['OH'], stress: 2, long: false }),
  seg(2, 4, { sounds: ['NG'], tie: true }),
  seg(4, 5, { kind: 'vowel', sounds: ['AX'], stress: 0, long: false }),
];
const sounds = (): WordSounds[] => [
  { i: 5, w: 'snakker', segs: SNAKKER },
  { i: 6, w: 'norsk', segs: [seg(0, 4, { sounds: ['X'] })] },
];

const view = (lens: 'stress' | 'sounds' | 'melody' | 'respell' | null) => ({ lens });

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>
  );
}

describe('ProsodyText', () => {
  it('is the plain passage without a lens', () => {
    const { container } = render(<ProsodyText text={TEXT} layer={layer()} view={view(null)} />);
    expect(container.textContent).toBe(TEXT);
    expect(container.querySelector('[data-mark],[data-word]')).toBeNull();
  });

  it('stress: the stressed vowel set apart with a ×, a long one with a band', () => {
    const { container } = render(<ProsodyText text={TEXT} layer={layer()} view={view('stress')} />);
    const vowels = container.querySelectorAll('[data-vowel]');
    expect(vowels).toHaveLength(3);
    expect(vowels[0]).toHaveAttribute('data-vowel', 'long');
    expect(vowels[0]?.textContent).toBe('×e');
    expect(container.querySelectorAll('[data-sign="cross"]')).toHaveLength(3);
    // The stress lens draws neither the melody signs nor a group end.
    expect(container.querySelector('[data-mark="boundary"]')).toBeNull();
    expect(container.querySelector('[data-sign="1"],[data-sign="2"]')).toBeNull();
  });

  it('melody: a toneme sign over the vowel, the accent word bold, the group end, the link', () => {
    const { container } = render(<ProsodyText text={TEXT} layer={layer()} view={view('melody')} />);
    expect(container.querySelectorAll('[data-sign="2"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-sign="dot"]')).toHaveLength(1);
    expect(container.querySelector('[data-mark="boundary"]')).toHaveAttribute('data-pitch', 'rise');
    expect(container.querySelector('[data-mark="boundary"]')?.textContent).toBe('↗|');
    const anna = [...container.querySelectorAll('[data-word]')].find((n) =>
      n.textContent?.includes('nna'),
    );
    expect(anna).toHaveStyle({ fontWeight: '700' });
    expect(container.querySelector('[class*="‿"]')).not.toBeNull();
  });

  it('sounds: silent letters pale, the weak vowel fainter, letters of one sound bracketed', () => {
    const text = 'tunge';
    const { container } = render(
      <ProsodyText
        text={text}
        layer={emptyProsodyLayer()}
        sounds={[{ i: 0, w: 'tunge', segs: TUNGE }]}
        view={view('sounds')}
      />,
    );
    expect(container.querySelector('[data-tie]')?.textContent).toBe('ng');
    const schwa = [...container.querySelectorAll('[data-seg="vowel"]')].at(-1) as HTMLElement;
    expect(schwa.textContent).toBe('e');
    expect(schwa.style.opacity).toBe('0.4');
    expect(container.textContent).toBe(text);
  });

  it('respell: the word as it sounds, the written word kept for a screen reader', () => {
    const { container } = render(
      <ProsodyText
        text="tunge"
        layer={emptyProsodyLayer()}
        sounds={[{ i: 0, w: 'tunge', segs: TUNGE }]}
        view={view('respell')}
      />,
    );
    expect(container.querySelector('[data-respell]')?.textContent).toBe('t×oŋe');
    expect(container.querySelector('.sr-only')?.textContent).toBe('tunge');
  });

  it('draws nothing on a word the lens has no data for, and keeps every character in order', () => {
    const { container } = render(
      <ProsodyText text={TEXT} layer={layer()} sounds={sounds()} view={view('sounds')} />,
    );
    // Only *snakker* has usable sounds (*norsk*'s segments do not cover its letters).
    expect(container.querySelectorAll('[data-lens="sounds"]')).toHaveLength(1);
    expect(container.textContent).toBe(TEXT);
  });

  it('keeps the text through every lens (signs are aria-hidden; the respelled word is replaced for the eye only)', () => {
    for (const lens of ['stress', 'sounds', 'melody'] as const) {
      const { container, unmount } = render(
        <ProsodyText text={TEXT} layer={layer()} sounds={sounds()} view={view(lens)} />,
      );
      container.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      expect(container.textContent).toBe(TEXT);
      unmount();
    }
  });

  it('drops a mark whose word is no longer the one it was set on', () => {
    const stale = layer();
    stale.stresses = [{ ...stale.stresses[0]!, w: 'bor' }];
    stale.accents = [];
    stale.boundaries = [];
    stale.links = [];
    const { container } = render(<ProsodyText text={TEXT} layer={stale} view={view('stress')} />);
    expect(container.querySelector('[data-vowel]')).toBeNull();
  });
});

describe('ProsodyControls', () => {
  const base = { mode: 'meaning', lens: 'stress', legend: true } as const;

  it('shows only the modes while the learner reads for meaning', () => {
    render(withIntl(<ProsodyControls settings={base} onChange={() => {}} />));
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Meaning',
      'By sentence',
      'Whole text',
    ]);
  });

  it('changes the mode and keeps the lens', async () => {
    const onChange = vi.fn();
    render(withIntl(<ProsodyControls settings={base} onChange={onChange} />));
    await userEvent.click(screen.getByRole('radio', { name: 'By sentence' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'sentences', lens: 'stress', legend: true });
  });

  it('offers one lens at a time, and the melody only where the phrase is marked', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      withIntl(
        <ProsodyControls
          settings={{ ...base, mode: 'text' }}
          onChange={onChange}
          melody={false}
        />,
      ),
    );
    expect(screen.queryByRole('radio', { name: 'Melody' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Stress' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'As it sounds' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'text', lens: 'respell', legend: true });

    rerender(withIntl(<ProsodyControls settings={{ ...base, mode: 'text' }} onChange={onChange} />));
    expect(screen.getByRole('radio', { name: 'Melody' })).toBeInTheDocument();
  });

  it('switches the legend', async () => {
    const onChange = vi.fn();
    render(withIntl(<ProsodyControls settings={{ ...base, mode: 'text' }} onChange={onChange} />));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show the legend' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'text', lens: 'stress', legend: false });
  });
});

describe('ProsodyLegend', () => {
  it.each(['stress', 'sounds', 'respell', 'melody'] as const)('draws the signs of %s', (lens) => {
    const { container } = render(withIntl(<ProsodyLegend lens={lens} />));
    expect(container.querySelector(`[data-legend="${lens}"]`)).not.toBeNull();
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('draws the melody legend with the very components of the text', () => {
    const { container } = render(withIntl(<ProsodyLegend lens="melody" />));
    expect(container.querySelector('[data-sign="1"]')).not.toBeNull();
    expect(container.querySelector('[data-sign="2"]')).not.toBeNull();
    expect(container.querySelector('[data-sign="dot"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-mark="boundary"]')).toHaveLength(2);
  });
});

describe('SentenceDrill', () => {
  const settings = { mode: 'sentences', lens: 'stress', legend: true } as const;
  const unit = { key: 'p1', text: 'Jeg heter Anna. Hun snakker norsk.', layer: emptyProsodyLayer(), sounds: [] };

  it('shows one sentence large, moves between them and lists them all', async () => {
    const l = emptyProsodyLayer();
    l.stresses = [
      { i: 1, w: 'heter', toneme: 2, vowel: { s: 1, e: 2, long: true }, source: 'lexicon' },
      { i: 4, w: 'snakker', toneme: 2, vowel: { s: 2, e: 3, long: false }, source: 'lexicon' },
    ];
    const { container } = render(
      withIntl(<SentenceDrill units={[{ ...unit, layer: l }]} settings={settings} />),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Sentence 1 of 2');
    expect(container.querySelector('p')?.textContent).toBe('Jeg h×eter Anna.');
    // The second sentence's stress was at token 4 in the passage and is token 1 inside it.
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sentence 2 of 2');
    expect(container.querySelector('[data-vowel]')?.textContent).toBe('×a');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(within(screen.getByRole('list', { name: 'All sentences' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the legend of the lens only when the learner asked for it', () => {
    const { container, rerender } = render(
      withIntl(<SentenceDrill units={[unit]} settings={settings} />),
    );
    expect(container.querySelector('[data-legend="stress"]')).not.toBeNull();
    rerender(withIntl(<SentenceDrill units={[unit]} settings={{ ...settings, legend: false }} />));
    expect(container.querySelector('[data-legend]')).toBeNull();
  });

  it('draws nothing for a text without a sentence', () => {
    const { container } = render(
      withIntl(<SentenceDrill units={[{ ...unit, text: ' — ' }]} settings={settings} />),
    );
    expect(container.querySelector('[data-drill]')).toBeNull();
  });
});

describe('answerOf (a sentence heard)', () => {
  it('reads the words and remarks of an ok answer as a rehearsal does', () => {
    const answer = answerOf({
      status: 'ok',
      feedback: { summary: '', items: [], words: [{ text: 'Jeg', passageIndex: 0, accuracy: 90 }] },
    });
    expect(answer.kind).toBe('heard');
    expect(answer.kind === 'heard' && answer.result.feedback?.words[0]?.text).toBe('Jeg');
  });

  it.each([
    [{ status: 'refused', reason: 'attempt_limit' }, 'tryLimit'],
    [{ status: 'refused', reason: 'language_not_supported' }, 'unsupported'],
    [{ status: 'refused', reason: 'not_available' }, 'failed'],
    [{ status: 'failed', errorCode: 'recording_inaudible' }, 'inaudible'],
    [{ status: 'failed', errorCode: 'recording_not_ready' }, 'notReady'],
    [{ status: 'failed', errorCode: 'timeout' }, 'failed'],
    [null, 'failed'],
  ])('says %j in a line: %s', (raw, line) => {
    expect(answerOf(raw)).toEqual({ kind: 'line', line });
  });
});

describe('SentenceDrill with a recording (plan 86, step 6g)', () => {
  const settings = { mode: 'sentences', lens: 'stress', legend: false } as const;
  const unit = { key: 'p1', text: 'Jeg heter Anna. Hun snakker norsk.', layer: emptyProsodyLayer(), sounds: [] };

  it('records the sentence on show, sends it with its prompt and draws what was heard', async () => {
    const port = createMockRecorder();
    const check = vi.fn(
      async (): Promise<SentenceAnswer> => ({
        kind: 'line',
        line: 'tryLimit',
      }),
    );
    render(withIntl(<SentenceDrill units={[unit]} settings={settings} recording={{ createPort: () => port, check }} />));

    await userEvent.click(screen.getByRole('button', { name: 'Say it' }));
    expect(port.calls.start).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'p1', sentence: 'Jeg heter Anna.' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('tried this sentence enough');
    expect(port.calls.close).toBe(1);
  });

  it('says so when the microphone is blocked, and sends nothing', async () => {
    const port = createMockRecorder();
    port.openWith('denied');
    const check = vi.fn();
    render(withIntl(<SentenceDrill units={[unit]} settings={settings} recording={{ createPort: () => port, check }} />));

    await userEvent.click(screen.getByRole('button', { name: 'Say it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('microphone is blocked');
    expect(check).not.toHaveBeenCalled();
  });

  it('takes the button away once the attempt cannot be checked any more', async () => {
    const port = createMockRecorder();
    const check = vi.fn(async (): Promise<SentenceAnswer> => ({ kind: 'line', line: 'closed' }));
    render(withIntl(<SentenceDrill units={[unit]} settings={settings} recording={{ createPort: () => port, check }} />));

    await userEvent.click(screen.getByRole('button', { name: 'Say it' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Say it/ })).toBeNull();
  });

  it('offers no microphone without a recording', () => {
    render(withIntl(<SentenceDrill units={[unit]} settings={settings} />));
    expect(screen.queryByRole('button', { name: 'Say it' })).toBeNull();
  });
});
