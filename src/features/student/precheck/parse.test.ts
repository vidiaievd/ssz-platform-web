import { describe, expect, it } from 'vitest';

import { parsePrecheckResult } from './parse';

const ANSWER = {
  attemptId: 'att-1',
  templateCode: 'writing_task',
  selfCheck: null,
  ai: { status: 'ok' },
  feedback: {
    summary: 'Two slips.',
    items: [
      {
        kind: 'grammar',
        target: { span: [0, 3] },
        original: 'har gå',
        suggestion: null,
        explanation: 'Past participle after «har».',
        atomRef: null,
        severity: 'major',
        modelId: 'secret-model',
      },
      { kind: 'unheard-of', explanation: 'dropped' },
      { kind: 'lexis', explanation: 'minor by default' },
    ],
    words: [{ text: 'jeg', passageIndex: 0, accuracy: 91, phonemes: [] }, { nope: 1 }],
  },
  reading: null,
  remaining: { exercise: 2, learnerChecksApprox: null, learnerCredits: 4 },
};

describe('parsePrecheckResult', () => {
  it('copies the fields one by one, so nothing added upstream reaches the screen', () => {
    const result = parsePrecheckResult(ANSWER);

    expect(result?.feedback?.items[0]).toEqual({
      kind: 'grammar',
      original: 'har gå',
      suggestion: null,
      explanation: 'Past participle after «har».',
      severity: 'major',
    });
    expect(result?.remaining).toEqual({ exercise: 2, learnerChecksApprox: null });
  });

  it('drops an item it cannot read instead of failing the whole answer', () => {
    const result = parsePrecheckResult(ANSWER);

    expect(result?.feedback?.items.map((i) => i.kind)).toEqual(['grammar', 'lexis']);
    expect(result?.feedback?.items[1]?.severity).toBe('minor');
    expect(result?.feedback?.words).toEqual([{ text: 'jeg', passageIndex: 0, accuracy: 91 }]);
  });

  it('keeps the feedback only when the model actually answered', () => {
    const refused = parsePrecheckResult({
      ...ANSWER,
      ai: { status: 'refused', reason: 'exercise_limit' },
    });
    expect(refused?.ai).toEqual({ status: 'refused', reason: 'exercise_limit' });
    expect(refused?.feedback).toBeNull();
  });

  it('reads the share of each passage heard', () => {
    const result = parsePrecheckResult({
      ...ANSWER,
      reading: {
        passPercent: 80,
        prompts: [{ itemId: 'p1', percent: 90, passed: true, check: { ops: [] } }, { itemId: 3 }],
      },
    });
    expect(result?.reading).toEqual({
      passPercent: 80,
      prompts: [{ itemId: 'p1', percent: 90, passed: true }],
    });
  });

  it('is silent about an answer it cannot read', () => {
    expect(parsePrecheckResult(null)).toBeNull();
    expect(parsePrecheckResult({ ai: { status: 'mystery' } })).toBeNull();
    expect(parsePrecheckResult('nope')).toBeNull();
  });
});
