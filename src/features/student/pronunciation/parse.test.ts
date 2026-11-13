import { describe, expect, it } from 'vitest';

import { parseItems, parseResult, parseSession, parseStart, parseTake } from './parse';

const SESSION = {
  attemptId: 'a1',
  resumed: false,
  language: 'nb',
  basis: 'chosen',
  phase: 'drill',
  doneReason: null,
  takes: 1,
  maxTakes: 10,
  takeIndex: 1,
  sounds: [{ atomId: 'nb:kj', family: 'kj', status: 'open' }],
  diagnostic: null,
  step: {
    phase: 'drill',
    atomId: 'nb:kj',
    family: 'kj',
    elementIndex: 0,
    element: { kind: 'word', word: 'kino' },
    say: 'kino',
    sentence: 'Nå sier jeg kino igjen.',
    fails: 0,
  },
};

describe('parseSession', () => {
  it('reads a drill step', () => {
    const s = parseSession(SESSION);
    expect(s?.step).toMatchObject({ phase: 'drill', element: { kind: 'word', word: 'kino' }, say: 'kino' });
    expect(s?.takeIndex).toBe(1);
  });

  it('reads a pair and a phrase', () => {
    const at = (element: unknown) => parseSession({ ...SESSION, step: { ...SESSION.step, element, say: null } })?.step;
    expect(at({ kind: 'pair', words: ['kjenne', 'skjenne'], judged: [0] })).toMatchObject({
      element: { kind: 'pair', words: ['kjenne', 'skjenne'], judged: [0] },
    });
    expect(at({ kind: 'phrase', text: 'Jeg kjøper kjeks.', carriers: [] })).toMatchObject({
      element: { kind: 'phrase', text: 'Jeg kjøper kjeks.' },
    });
  });

  it('is silent about a live session with no readable step', () => {
    expect(parseSession({ ...SESSION, step: null })).toBeNull();
    expect(parseSession({ ...SESSION, step: { ...SESSION.step, element: { kind: 'x' } } })).toBeNull();
  });

  it('accepts a finished session without a step', () => {
    expect(parseSession({ ...SESSION, phase: 'done', doneReason: 'finished', step: null })).toMatchObject({
      phase: 'done',
      doneReason: 'finished',
      step: null,
    });
  });

  it('refuses a body that is not a session', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession({ ...SESSION, takeIndex: 'x' })).toBeNull();
  });
});

describe('parseStart', () => {
  it('turns the budget credits into numbers', () => {
    const r = parseStart({
      ...SESSION,
      budget: { payer: 'learner', metered: true, remainingCredits: '12.500000', estimatedCredits: '15.000000' },
    });
    expect(r?.budget).toEqual({ payer: 'learner', metered: true, remainingCredits: 12.5, estimatedCredits: 15 });
  });

  it('allows a missing budget', () => {
    expect(parseStart({ ...SESSION, budget: null })?.budget).toBeNull();
  });
});

describe('parseItems', () => {
  it('reads clips and the instruction, dropping unreadable clips', () => {
    const r = parseItems({
      session: SESSION,
      clips: [{ word: 'kino', url: 'https://x/a.mp3', mimeType: 'audio/mpeg' }, { word: 'bad' }],
      instruction: { atomId: 'nb:kj', title: 'kj', howTo: 'Tongue up', drill: null, commonError: 'sj', ukNote: null },
    });
    expect(r?.clips).toHaveLength(1);
    expect(r?.instruction).toMatchObject({ howTo: 'Tongue up', commonError: 'sj' });
  });

  it('has no instruction in the diagnostic', () => {
    expect(parseItems({ session: SESSION, clips: [], instruction: null })?.instruction).toBeNull();
  });
});

describe('parseTake', () => {
  const take = (over: object) => ({
    outcome: 'judged',
    reason: null,
    verdict: { measured: true, passed: false, key: 'KJ:major' },
    feedback: null,
    toneme: null,
    events: [{ kind: 'retry', atomId: 'nb:kj' }, { kind: 'bogus' }],
    session: SESSION,
    ...over,
  });

  it('reads the verdict and keeps only known events', () => {
    const r = parseTake(take({}));
    expect(r?.verdict).toEqual({ measured: true, passed: false, key: 'KJ:major' });
    expect(r?.events).toEqual([{ kind: 'retry', atomId: 'nb:kj' }]);
  });

  it('reads a toneme take with its melodies', () => {
    const r = parseTake(
      take({ toneme: { tone: 2, verdict: 'like_reference', melody: { stepMs: 10, learner: [1, null], reference: [2, 3] } } }),
    );
    expect(r?.toneme?.melody).toEqual({ stepMs: 10, learner: [1, null], reference: [2, 3] });
  });

  it('drops a toneme whose melody cannot be read', () => {
    expect(parseTake(take({ toneme: { tone: 1, verdict: 'x', melody: { stepMs: 0 } } }))?.toneme).toBeNull();
  });

  it('reads the remarks of a sounds take', () => {
    const r = parseTake(take({ feedback: { summary: 'Close', items: [] } }));
    expect(r?.feedback?.summary).toBe('Close');
  });

  it('refuses an unknown outcome', () => {
    expect(parseTake(take({ outcome: 'maybe' }))).toBeNull();
  });
});

describe('parseResult', () => {
  it('reads ratings and keeps null for a sound the session does not rate', () => {
    const r = parseResult({
      score: 50,
      doneReason: 'finished',
      sounds: [
        { atomId: 'nb:kj', status: 'passed', passes: 1, fails: 0, rating: 'GOOD' },
        { atomId: 'nb:sj', status: 'open', passes: 0, fails: 1, rating: null },
      ],
      diagnosticWeak: ['kj'],
      flagged: ['nb:r'],
    });
    expect(r?.sounds.map((s) => s.rating)).toEqual(['GOOD', null]);
    expect(r?.flagged).toEqual(['nb:r']);
  });
});
