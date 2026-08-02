import { describe, expect, it } from 'vitest';

import { checkShortAnswer } from './short-answer-diff';

/** The seeded indirect-speech task from Norsk B1, leksjon 1. */
const indirectSpeech = {
  reference_answer: 'Bartek sa at han skulle begynne 1. april.',
  accepted_answers: [
    'bartek sa at han skulle begynne 1. april',
    'at han skulle begynne 1. april',
  ],
};

describe('checkShortAnswer', () => {
  it('passes an exact answer regardless of case and final punctuation', () => {
    const result = checkShortAnswer(indirectSpeech, 'Bartek sa at han skulle begynne 1. april.');
    expect(result.ok).toBe(true);
    expect(result.score).toBe(100);
    expect(result.distance).toBe(0);
  });

  it('passes the shorter accepted phrasing', () => {
    expect(checkShortAnswer(indirectSpeech, 'at han skulle begynne 1. april').ok).toBe(true);
  });

  it('names an inflection slip instead of waiting on a teacher', () => {
    const result = checkShortAnswer(indirectSpeech, 'at han skulle begynte 1. april');
    expect(result.ok).toBe(false);
    expect(result.counts).toEqual({ form: 1, wrong: 0, extra: 0, missing: 0 });
    expect(result.tokens).toContainEqual({
      outcome: 'form',
      submitted: 'begynte',
      expected: 'begynne',
    });
  });

  it('scores the answer from the screenshot as a near miss with both faults', () => {
    // Missing the required `at`, and `begynte` for `begynne`.
    const result = checkShortAnswer(indirectSpeech, 'han skulle begynte 1. april');
    expect(result.ok).toBe(false);
    expect(result.target).toBe('at han skulle begynne 1. april');
    expect(result.counts).toEqual({ form: 1, wrong: 0, extra: 0, missing: 1 });
    expect(result.tokens[0]).toEqual({ outcome: 'missing', expected: 'at' });
  });

  it('flags a word the learner added', () => {
    const result = checkShortAnswer(indirectSpeech, 'at han skulle jo begynne 1. april');
    expect(result.ok).toBe(false);
    expect(result.counts.extra).toBe(1);
    expect(result.tokens).toContainEqual({ outcome: 'extra', submitted: 'jo' });
  });

  it('still routes a genuinely different sentence for review', () => {
    const result = checkShortAnswer(indirectSpeech, 'jeg vet ikke hva han mente med det');
    expect(result.ok).toBeNull();
  });

  it('allows one slip even in a two-word answer', () => {
    // Short stems ("tar" / "tatt") stay below the inflection heuristic, so this
    // reads as a wrong word — still named and corrected, just not as a form.
    const result = checkShortAnswer({ reference_answer: 'hadde tatt' }, 'hadde tar');
    expect(result.ok).toBe(false);
    expect(result.counts.wrong).toBe(1);
    expect(result.tokens).toContainEqual({
      outcome: 'wrong',
      submitted: 'tar',
      expected: 'tatt',
    });
  });

  it('accepts both readings of an answer with an optional part', () => {
    const key = {
      reference_answer: 'Søppelet blir hentet (av kommunen).',
      accepted_answers: ['søppelet blir hentet', 'søppelet blir hentet av kommunen'],
    };
    expect(checkShortAnswer(key, 'Søppelet blir hentet.').ok).toBe(true);
    expect(checkShortAnswer(key, 'Søppelet blir hentet av kommunen.').ok).toBe(true);
  });

  it('picks the closest of several accepted phrasings', () => {
    const key = {
      reference_answer: 'Jeg skulle ha tatt pause.',
      accepted_answers: ['jeg skulle ha tatt pause', 'jeg burde ha tatt pause'],
    };
    const result = checkShortAnswer(key, 'jeg burde ha tatt pausen');
    expect(result.target).toBe('jeg burde ha tatt pause');
    expect(result.counts.form).toBe(1);
  });

  it('falls back to the reference answer when no shortcuts are authored', () => {
    const result = checkShortAnswer({ reference_answer: 'på radio' }, 'på radio');
    expect(result.ok).toBe(true);
  });

  it('reviews an empty submission rather than marking it wrong', () => {
    const result = checkShortAnswer(indirectSpeech, '   ');
    expect(result.ok).toBeNull();
    expect(result.tokens).toEqual([]);
  });

  it('reviews when the exercise carries no answer key at all', () => {
    expect(checkShortAnswer({ reference_answer: '' }, 'noe').ok).toBeNull();
  });
});
