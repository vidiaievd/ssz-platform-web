import { describe, expect, it } from 'vitest';

import {
  accuracyBand,
  checksLeft,
  mayAskAgain,
  noticeOf,
  precheckCapable,
  rulesToRevisit,
  wordsByPassage,
} from './capability';
import type { PrecheckResult } from './types';

const base: PrecheckResult = {
  courseId: null,
  selfCheck: null,
  ai: { status: 'ok' },
  feedback: { summary: 'ok', items: [], words: [] },
  reading: null,
  remaining: null,
};

describe('precheckCapable', () => {
  it('rehearses the key-and-model templates and the model-only ones', () => {
    for (const code of [
      'translate_to_target',
      'translate_from_target',
      'error_correction',
      'writing_task',
      'short_answer',
    ]) {
      expect(precheckCapable(code)).toBe(true);
    }
  });

  it('leaves out what is checked on the spot — a rehearsal there would hand over the answer', () => {
    for (const code of ['word_bank_gap_fill', 'multiple_choice', 'match_pairs', 'dictation']) {
      expect(precheckCapable(code)).toBe(false);
    }
  });

  it('rehearses read_aloud only when it is read from a text', () => {
    expect(precheckCapable('read_aloud', 'read')).toBe(true);
    expect(precheckCapable('read_aloud', 'monologue')).toBe(false);
    expect(precheckCapable('read_aloud')).toBe(false);
  });
});

describe('noticeOf', () => {
  it('draws the remarks when the model answered', () => {
    expect(noticeOf(base)).toEqual({ kind: 'remarks' });
  });

  it('treats an ok with nothing to show as a failure rather than an empty panel', () => {
    expect(noticeOf({ ...base, feedback: null })).toEqual({ kind: 'line', key: 'failed' });
  });

  it('names each refusal by its line', () => {
    const refused = (reason: string): PrecheckResult => ({
      ...base,
      ai: { status: 'refused', reason },
      feedback: null,
    });
    expect(noticeOf(refused('exercise_limit'))).toEqual({ kind: 'line', key: 'exerciseLimit' });
    expect(noticeOf(refused('learner_limit'))).toEqual({ kind: 'line', key: 'learnerLimit' });
    expect(noticeOf(refused('pool_empty'))).toEqual({ kind: 'line', key: 'poolEmpty' });
    expect(noticeOf(refused('unaskable'))).toEqual({ kind: 'line', key: 'emptyAnswer' });
    expect(noticeOf(refused('anything_else'))).toEqual({ kind: 'line', key: 'failed' });
  });

  it('tells a recording that is not ready from a failure', () => {
    const failed = (errorCode: string): PrecheckResult => ({
      ...base,
      ai: { status: 'failed', errorCode },
      feedback: null,
    });
    expect(noticeOf(failed('recording_not_ready'))).toEqual({ kind: 'line', key: 'notReady' });
    expect(noticeOf(failed('ai_unavailable'))).toEqual({ kind: 'line', key: 'failed' });
  });

  it('says the key settled it, and says nothing for the other reasons the model was not asked', () => {
    const notAsked = (reason: string): PrecheckResult => ({
      ...base,
      ai: { status: 'not_asked', reason },
      feedback: null,
    });
    expect(noticeOf(notAsked('key_settles'))).toEqual({ kind: 'line', key: 'keySettles' });
    expect(noticeOf(notAsked('disabled'))).toEqual({ kind: 'none' });
  });
});

describe('limits', () => {
  it('offers another check unless the exercise limit is known to be spent', () => {
    expect(mayAskAgain(null)).toBe(true);
    expect(mayAskAgain({ exercise: null, learnerChecksApprox: 0 })).toBe(true);
    expect(mayAskAgain({ exercise: 2, learnerChecksApprox: null })).toBe(true);
    expect(mayAskAgain({ exercise: 0, learnerChecksApprox: 9 })).toBe(false);
  });

  it('promises the smaller of the two counts, and nothing when neither is limited', () => {
    expect(checksLeft(null)).toBeNull();
    expect(checksLeft({ exercise: null, learnerChecksApprox: null })).toBeNull();
    expect(checksLeft({ exercise: 3, learnerChecksApprox: 8 })).toBe(3);
    expect(checksLeft({ exercise: null, learnerChecksApprox: 5 })).toBe(5);
  });
});

describe('reading helpers', () => {
  it('bands a word score', () => {
    expect(accuracyBand(95)).toBe('good');
    expect(accuracyBand(80)).toBe('good');
    expect(accuracyBand(60)).toBe('fair');
    expect(accuracyBand(10)).toBe('low');
  });

  it('groups the words heard by the passage they were read in, in order', () => {
    const groups = wordsByPassage({
      summary: '',
      items: [],
      words: [
        { text: 'jeg', passageIndex: 0, accuracy: 90 },
        { text: 'bor', passageIndex: 0, accuracy: 70 },
        { text: 'i', passageIndex: 1, accuracy: null },
      ],
    });
    expect(groups.map((g) => [g.passageIndex, g.words.length])).toEqual([
      [0, 2],
      [1, 1],
    ]);
  });
});

describe('rulesToRevisit', () => {
  const item = (atomId: string | null) => ({
    kind: 'grammar' as const,
    original: null,
    suggestion: null,
    explanation: 'x',
    severity: 'minor' as const,
    atom: atomId === null ? null : { atomId, status: 'covered' as const, ruleTitle: 'R', title: 't' },
  });

  it('lists each rule once, in the order first named', () => {
    const feedback = { summary: 's', words: [], items: [item('b'), item(null), item('a'), item('b')] };
    expect(rulesToRevisit(feedback).map((r) => r.atomId)).toEqual(['b', 'a']);
  });
});
