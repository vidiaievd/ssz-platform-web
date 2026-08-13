import { describe, expect, it } from 'vitest';

import {
  normAnswer,
  gradeMcq,
  gradeFill,
  gradeSentenceSchema,
  gradeTranslate,
  gradeMatch,
  type TranslateExpectedAnswers,
  checkWordBankFill,
  checkTextOrder,
} from './grading';
import type { McqExpectedAnswers } from './mcq-body';
import type { FillExpectedAnswers } from './fill-body';
import type { MatchPair } from './match-body';

/* ── normAnswer ──────────────────────────────────────────────────── */

describe('normAnswer', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normAnswer('  hjemme  ')).toBe('hjemme');
  });

  it('lowercases', () => {
    expect(normAnswer('Hjemme')).toBe('hjemme');
  });

  it('strips a single trailing period', () => {
    expect(normAnswer('hjemme.')).toBe('hjemme');
  });

  it('strips trailing comma, exclamation, question mark, semicolon', () => {
    expect(normAnswer('ok,')).toBe('ok');
    expect(normAnswer('ok!')).toBe('ok');
    expect(normAnswer('ok?')).toBe('ok');
    expect(normAnswer('ok;')).toBe('ok');
  });

  it('strips multiple trailing punctuation characters', () => {
    expect(normAnswer('really?!')).toBe('really');
  });

  it('collapses internal whitespace', () => {
    expect(normAnswer('det  er   travelt')).toBe('det er travelt');
  });

  it('handles empty string', () => {
    expect(normAnswer('')).toBe('');
  });

  it('does not strip punctuation in the middle of the string', () => {
    expect(normAnswer("it's fine")).toBe("it's fine");
  });

  it('handles null/undefined-like empty call gracefully', () => {
    // normAnswer is typed string so this tests empty
    expect(normAnswer('   ')).toBe('');
  });
});

/* ── gradeMcq ────────────────────────────────────────────────────── */

describe('gradeMcq', () => {
  const ea: McqExpectedAnswers = { correct_option_ids: ['opt-b'] };

  it('returns true when selectedId is in correct_option_ids', () => {
    expect(gradeMcq(ea, 'opt-b')).toBe(true);
  });

  it('returns false when selectedId is not correct', () => {
    expect(gradeMcq(ea, 'opt-a')).toBe(false);
  });

  it('returns false when selectedId is null', () => {
    expect(gradeMcq(ea, null)).toBe(false);
  });

  it('supports multiple correct option ids', () => {
    const multi: McqExpectedAnswers = { correct_option_ids: ['opt-a', 'opt-c'] };
    expect(gradeMcq(multi, 'opt-a')).toBe(true);
    expect(gradeMcq(multi, 'opt-c')).toBe(true);
    expect(gradeMcq(multi, 'opt-b')).toBe(false);
  });
});

/* ── gradeFill ───────────────────────────────────────────────────── */

describe('gradeFill', () => {
  const ea: FillExpectedAnswers = { answers: { '1': 'hjemme' } };

  it('returns true for exact match', () => {
    expect(gradeFill(ea, 'hjemme')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(gradeFill(ea, 'Hjemme')).toBe(true);
  });

  it('tolerates leading/trailing whitespace', () => {
    expect(gradeFill(ea, '  hjemme  ')).toBe(true);
  });

  it('returns false for wrong answer', () => {
    expect(gradeFill(ea, 'jobben')).toBe(false);
  });

  it('returns false for empty value', () => {
    expect(gradeFill(ea, '')).toBe(false);
  });

  it('returns false when blank index has no expected answer', () => {
    expect(gradeFill({ answers: {} }, 'hjemme')).toBe(false);
  });

  it('accepts a custom blank index', () => {
    const multi: FillExpectedAnswers = { answers: { '1': 'foo', '2': 'bar' } };
    expect(gradeFill(multi, 'bar', '2')).toBe(true);
    expect(gradeFill(multi, 'foo', '2')).toBe(false);
  });

  it('strips trailing punctuation before comparing', () => {
    const withPunct: FillExpectedAnswers = { answers: { '1': 'hjemme.' } };
    expect(gradeFill(withPunct, 'hjemme')).toBe(true);
    expect(gradeFill(ea, 'hjemme.')).toBe(true);
  });
});

/* ── gradeTranslate ──────────────────────────────────────────────── */

describe('gradeTranslate', () => {
  const ea: TranslateExpectedAnswers = {
    accepted_answers: ['Det er et travelt yrke.', "It's a busy job"],
  };

  it('returns true when value matches first accepted answer (after norm)', () => {
    expect(gradeTranslate(ea, 'Det er et travelt yrke.')).toBe(true);
  });

  it('returns true when value matches second accepted answer', () => {
    expect(gradeTranslate(ea, "it's a busy job")).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(gradeTranslate(ea, 'DET ER ET TRAVELT YRKE')).toBe(true);
  });

  it('tolerates leading/trailing whitespace', () => {
    expect(gradeTranslate(ea, '  det er et travelt yrke  ')).toBe(true);
  });

  it('returns false when no accepted answer matches', () => {
    expect(gradeTranslate(ea, 'something completely different')).toBe(false);
  });

  it('returns false for empty value', () => {
    expect(gradeTranslate(ea, '')).toBe(false);
  });
});

/* ── gradeMatch ──────────────────────────────────────────────────── */

describe('gradeMatch', () => {
  const pairs: MatchPair[] = [
    { id: 'p1', left: 'hus', right: 'house' },
    { id: 'p2', left: 'bil', right: 'car' },
  ];

  it('returns true when all pairs are linked to their own id', () => {
    expect(gradeMatch(pairs, { p1: 'p1', p2: 'p2' })).toBe(true);
  });

  it('returns false when one pair is wrong (crossed links)', () => {
    expect(gradeMatch(pairs, { p1: 'p2', p2: 'p1' })).toBe(false);
  });

  it('returns false when a pair is missing from links', () => {
    expect(gradeMatch(pairs, { p1: 'p1' })).toBe(false);
  });

  it('returns false for empty links', () => {
    expect(gradeMatch(pairs, {})).toBe(false);
  });

  it('returns true for a single-pair set linked correctly', () => {
    const one: MatchPair[] = [{ id: 'a', left: 'hund', right: 'dog' }];
    expect(gradeMatch(one, { a: 'a' })).toBe(true);
  });

  it('returns false for a single-pair set linked wrongly', () => {
    const one: MatchPair[] = [{ id: 'a', left: 'hund', right: 'dog' }];
    expect(gradeMatch(one, { a: 'b' })).toBe(false);
  });
});

describe('gradeSentenceSchema', () => {
  const expected = {
    placements: [
      { field_id: 'f1', token_ids: ['t1'] },
      { field_id: 'f2', token_ids: ['t2', 't3'] },
    ],
  };

  it('returns true when every field matches exactly', () => {
    expect(gradeSentenceSchema(expected, { f1: ['t1'], f2: ['t2', 't3'] })).toBe(true);
  });

  it('is order-sensitive within a field', () => {
    expect(gradeSentenceSchema(expected, { f1: ['t1'], f2: ['t3', 't2'] })).toBe(false);
  });

  it('returns false when a field is missing tokens', () => {
    expect(gradeSentenceSchema(expected, { f1: ['t1'], f2: ['t2'] })).toBe(false);
  });
});

describe('checkWordBankFill', () => {
  const expected = {
    items: [
      { id: '1', blanks: [{ blank_id: 1, accepted_answers: ['show off'] }] },
      {
        id: '2',
        blanks: [
          { blank_id: 1, accepted_answers: ['clicked with', 'clicked'] },
          { blank_id: 2, accepted_answers: ['get to know'] },
        ],
      },
    ],
  };

  it('is ok only when every blank matches', () => {
    const result = checkWordBankFill(expected, {
      '1': { 1: 'show off' },
      '2': { 1: 'clicked', 2: 'get to know' },
    });

    expect(result.ok).toBe(true);
    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
  });

  it('counts an unanswered blank as wrong and keeps it in the total', () => {
    const result = checkWordBankFill(expected, { '1': { 1: 'show off' } });

    expect(result.ok).toBe(false);
    expect(result.correct).toBe(1);
    expect(result.total).toBe(3);
    expect(result.results['2']![1]).toEqual({ correct: false, expected: 'clicked with' });
  });

  it('normalizes case and whitespace like the other graders', () => {
    const result = checkWordBankFill(expected, {
      '1': { 1: '  Show Off ' },
      '2': { 1: 'CLICKED', 2: 'get to know' },
    });

    expect(result.ok).toBe(true);
  });

  it('carries an authored rationale into the result, as the engine does', () => {
    const rationale = { options: [{ text: 'show off', verdict: 'correct' as const }] };
    const result = checkWordBankFill(
      {
        items: [{ id: '1', blanks: [{ blank_id: 1, accepted_answers: ['show off'], rationale }] }],
      },
      { '1': { 1: 'boast' } },
    );

    expect(result.results['1']![1]).toEqual({ correct: false, expected: 'show off', rationale });
  });

  it('leaves the result free of a rationale key when none is authored', () => {
    const result = checkWordBankFill(expected, { '1': { 1: 'boast' } });
    expect(result.results['1']![1]).not.toHaveProperty('rationale');
  });
});

describe('checkTextOrder', () => {
  const expected = { order: ['a', 'b', 'c', 'd'] };

  it('is ok only for the exact sequence', () => {
    expect(checkTextOrder(expected, ['a', 'b', 'c', 'd']).ok).toBe(true);
    expect(checkTextOrder(expected, ['a', 'c', 'b', 'd']).ok).toBe(false);
  });

  it('counts items sitting in their own slot', () => {
    const result = checkTextOrder(expected, ['a', 'c', 'b', 'd']);

    expect(result.correct).toBe(2);
    expect(result.total).toBe(4);
    expect(result.results).toEqual({ a: true, b: false, c: false, d: true });
  });

  it('is never ok when items are missing, even if the rest line up', () => {
    const result = checkTextOrder(expected, ['a', 'b', 'c']);

    expect(result.ok).toBe(false);
    expect(result.correct).toBe(3);
  });
});
