import { describe, expect, it } from 'vitest';

import { sampleDocument, toContent, toStudentProjection } from '@/lib/shared-kernel/minimal-pairs';

import {
  readMinimalPairsProjection,
  readMinimalPairsSummary,
  readProbe,
  readProbeVerdict,
} from './minimal-pairs-projection';

const PROJECTION = toStudentProjection(toContent(sampleDocument()));

const PROBE = {
  n: 2,
  total: 12,
  questionId: 'p2',
  clip: {
    url: 'https://media.test/a.mp3',
    expiresAt: '2026-10-09T12:00:00Z',
    durationMs: 780,
    provenance: 'tts',
    dialect: 'ost',
  },
  options: [{ id: 'w1' }, { id: 'w2', text: 'skjære' }],
  state: { tries: 1, maxTries: 2, closed: false },
  closedProbes: [{ n: 1, correct: true }],
};

describe('readMinimalPairsProjection', () => {
  it("reads the kernel's own projection whole", () => {
    expect(readMinimalPairsProjection(PROJECTION)).toEqual(PROJECTION);
  });

  // The stored document is the key: which clip is which word (plan 72 §3.2).
  it.each(['pairs', 'scoring', 'contrastId', 'note', 'passPct'])(
    'refuses a projection carrying `%s`',
    (field) => {
      expect(readMinimalPairsProjection({ ...PROJECTION, [field]: [] })).toBeNull();
    },
  );

  it('refuses the stored content outright', () => {
    expect(readMinimalPairsProjection(toContent(sampleDocument()))).toBeNull();
  });

  it('reads an unknown listen budget as two, never as unlimited', () => {
    const odd = { ...PROJECTION, set: { ...PROJECTION.set, playsPerProbe: 9 } };
    expect(readMinimalPairsProjection(odd)?.set.playsPerProbe).toBe(2);
  });
});

describe('readProbe', () => {
  it('reads the probe as the engine handed it out', () => {
    expect(readProbe(PROBE)).toEqual(PROBE);
  });

  it('refuses a probe that names its own answer', () => {
    expect(readProbe({ ...PROBE, keyOptionId: 'w1' })).toBeNull();
    expect(readProbe({ ...PROBE, wordId: 'w1' })).toBeNull();
  });

  it('refuses a probe with no clip to play or fewer than two buttons', () => {
    expect(readProbe({ ...PROBE, clip: { ...PROBE.clip, url: '' } })).toBeNull();
    expect(readProbe({ ...PROBE, options: [{ id: 'w1' }] })).toBeNull();
  });
});

describe('readProbeVerdict', () => {
  const open = {
    questionId: 'p2',
    n: 2,
    optionId: 'w1',
    correct: false,
    closed: false,
    tries: 1,
    triesLeft: 1,
    firstCorrect: false,
  };

  it('reads nothing of the key on a probe still open, even if sent', () => {
    const v = readProbeVerdict({ ...open, keyOptionId: 'w2', options: [{ id: 'w2', text: 'x' }] });
    expect(v).toEqual(open);
  });

  it('reads the key, the spellings and the comparison once the probe closes', () => {
    const v = readProbeVerdict({
      ...open,
      closed: true,
      triesLeft: 0,
      keyOptionId: 'w2',
      options: [
        { id: 'w1', text: 'kjære', gloss: 'kjær' },
        { id: 'w2', text: 'skjære', ipa: '' },
      ],
      compare: { chosen: 'https://a', target: 'https://b' },
    });
    expect(v?.keyOptionId).toBe('w2');
    expect(v?.options).toEqual([
      { id: 'w1', text: 'kjære', gloss: 'kjær' },
      { id: 'w2', text: 'skjære' },
    ]);
    expect(v?.compare).toEqual({ chosen: 'https://a', target: 'https://b' });
  });
});

describe('readMinimalPairsSummary', () => {
  it('reads the result with its pass mark and memory', () => {
    const s = readMinimalPairsSummary({
      right: 3,
      total: 4,
      score: 75,
      passed: true,
      passPct: 75,
      memory: 'none',
      pairs: [{ pairId: 'a', words: ['kjære', 'skjære'], played: 4, correct: 3, clips: ['u', 7] }],
    });
    expect(s?.memory).toBe('none');
    expect(s?.pairs[0]?.clips).toEqual(['u', '']);
  });

  it('leaves out a memory it does not know, and refuses what is not a result', () => {
    const s = readMinimalPairsSummary({
      right: 1,
      total: 1,
      score: 100,
      passed: true,
      passPct: 75,
    });
    expect(s).not.toHaveProperty('memory');
    expect(readMinimalPairsSummary({ right: 1 })).toBeNull();
  });
});
