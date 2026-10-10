import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { SAMPLE_PAIR_IDS, type Issue } from '@/lib/shared-kernel/minimal-pairs';

import { useIssueCopy } from './issue-copy';
import { Intl, sampleMinimalPairs } from './test-support';

const pair = SAMPLE_PAIR_IDS[1];

/** One of every code, with the parameters the kernel gives it. */
const ALL: Issue[] = [
  { code: 'MP_NO_CONTRAST', level: 'blocker', step: 1, language: 'sv' },
  { code: 'MP_NO_PAIRS', level: 'blocker', step: 1 },
  { code: 'MP_PAIR_UNDER_TWO', level: 'blocker', step: 1, pairId: pair },
  { code: 'MP_PAIR_DUPLICATE', level: 'blocker', step: 1, pairId: pair },
  { code: 'MP_GROUP_TOO_LARGE', level: 'warning', step: 1, pairId: pair, words: 4 },
  { code: 'MP_FEW_PAIRS', level: 'warning', step: 1, ready: 2 },
  { code: 'MP_NO_GLOSS', level: 'info', step: 1, pairId: pair },
  { code: 'MP_MIXED_CONTRASTS', level: 'info', step: 1, contrastIds: ['kjsj', 'consonant'] },
  { code: 'MP_WORD_NO_CLIP', level: 'blocker', step: 2, pairId: pair, wordId: 'w', text: 'kjekk' },
  {
    code: 'MP_PAIR_MIXED_VOICES',
    level: 'blocker',
    step: 2,
    pairId: pair,
    voices: ['Ingrid', 'tts'],
  },
  { code: 'MP_TTS_BLOCKED', level: 'blocker', step: 2, contrastId: 'kjsj', count: 2 },
  {
    code: 'MP_CLIP_TOO_LONG',
    level: 'warning',
    step: 2,
    pairId: pair,
    wordId: 'w',
    text: 'kjekk',
    durationMs: 2900,
  },
  { code: 'MP_PAIR_LENGTH_SPREAD', level: 'warning', step: 2, pairId: pair, spreadMs: 410 },
  { code: 'MP_TTS_RISKY', level: 'warning', step: 2, contrastId: 'length', count: 1 },
  { code: 'MP_DIALECT_MISSING', level: 'warning', step: 2 },
  { code: 'MP_TTS_NOTE', level: 'info', step: 2, contrastId: 'vowel', count: 3 },
  { code: 'MP_POOL_TOO_SMALL', level: 'blocker', step: 3, probes: 12, pool: 8 },
  { code: 'MP_FEW_PROBES', level: 'warning', step: 3, probes: 6, min: 8 },
  { code: 'MP_MANY_PROBES', level: 'warning', step: 3, probes: 20, max: 15 },
  { code: 'MP_UNLIMITED_REPLAYS', level: 'warning', step: 3 },
  { code: 'MP_TOO_MANY_OPTIONS', level: 'warning', step: 3, options: 9 },
  { code: 'MP_NO_IMMEDIATE', level: 'warning', step: 4 },
  { code: 'MP_NO_AB', level: 'warning', step: 4 },
  { code: 'MP_SPELLING_HIDDEN', level: 'info', step: 4 },
  { code: 'MP_SECOND_CHANCE', level: 'info', step: 4 },
  { code: 'MP_WORD_MEMORY', level: 'warning', step: 5 },
  { code: 'MP_PASS_TOO_HIGH', level: 'warning', step: 5, passPct: 95, probes: 12 },
  { code: 'MP_NO_MEMORY', level: 'info', step: 5 },
  { code: 'MP_CONTRAST_CARD_LATER', level: 'info', step: 5 },
  { code: 'MP_EXPOSURE_LATER', level: 'info', step: 5 },
];

function Lines({ list }: { list: Issue[] }) {
  const copy = useIssueCopy(sampleMinimalPairs());
  return (
    <ul>
      {list.map((issue) => (
        <li key={issue.code} data-code={issue.code}>
          {copy.describe(issue)} | {copy.fix(issue)}
        </li>
      ))}
    </ul>
  );
}

describe('useIssueCopy — the words for every kernel code (§4.3)', () => {
  it('has a sentence and a fix for every code in every locale file', () => {
    const block = (enMessages as { Authoring: { minimalPairs: { issues: object; fixes: object } } })
      .Authoring.minimalPairs;
    for (const issue of ALL) {
      expect(Object.keys(block.issues)).toContain(issue.code);
      expect(Object.keys(block.fixes)).toContain(issue.code);
    }
  });

  it('fills every placeholder', () => {
    render(
      <Intl>
        <Lines list={ALL} />
      </Intl>,
    );
    for (const item of screen.getAllByRole('listitem')) {
      expect(item.textContent).not.toMatch(/[{}]|Authoring\.|minimalPairs\./);
    }
  });

  it('names a pair by its place now, a family by its pack label, a length in seconds', () => {
    render(
      <Intl>
        <Lines list={ALL} />
      </Intl>,
    );
    const line = (code: string) =>
      screen.getAllByRole('listitem').find((li) => li.dataset.code === code)!.textContent;
    expect(line('MP_PAIR_DUPLICATE')).toMatch(/^Pair 2 repeats/);
    expect(line('MP_PAIR_MIXED_VOICES')).toContain('(Ingrid / tts)');
    expect(line('MP_TTS_BLOCKED')).toContain('2 clips are synthetic, and «kj / sj»');
    expect(line('MP_CLIP_TOO_LONG')).toContain('«kjekk» is 2,90 s');
    expect(line('MP_FEW_PAIRS')).toMatch(/^2 usable pairs/);
    expect(line('MP_PASS_TOO_HIGH')).toContain('Pass at 95%. With 12 probes');
    expect(line('MP_WORD_NO_CLIP')).toContain('Record or generate it');
  });
});
