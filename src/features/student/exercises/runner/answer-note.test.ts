import { describe, expect, it } from 'vitest';

import { buildAnswerNote, type Rationale } from './answer-note';

/* Mirrors the real b1-g1 drill: three of seven bank words are analysed. */
const RATIONALE: Rationale = {
  explanation: '«Han er sliten» is a statement, and statements take «at».',
  options: [
    { text: 'at', verdict: 'correct', note: 'Statement → at.' },
    { text: 'om', verdict: 'wrong', note: 'Only for yes/no questions.' },
    { text: 'hvorfor', verdict: 'wrong', note: 'No question about a reason.' },
  ],
};

const base = { rationale: RATIONALE, chosen: 'om', correct: 'at', chosenCorrect: false };

describe('buildAnswerNote', () => {
  it('tells a missed blank only why its own word is wrong', () => {
    const note = buildAnswerNote(base);

    expect(note).toEqual({ chosen: { text: 'om', note: 'Only for yes/no questions.' } });
    // neither the accepted answer nor the rule that names it
    expect(note?.correct).toBeUndefined();
    expect(note?.explanation).toBeUndefined();
  });

  it('gives the rule and the accepted answer once the pick was right', () => {
    const note = buildAnswerNote({ ...base, chosen: 'at', chosenCorrect: true });
    expect(note?.chosen).toBeUndefined();
    expect(note?.explanation).toBe(RATIONALE.explanation);
    expect(note?.correct).toEqual({ text: 'at', note: 'Statement → at.' });
  });

  it('stays silent about a pick the author never analysed', () => {
    expect(buildAnswerNote({ ...base, chosen: 'hvordan' })).toBeNull();
  });

  it('prefers an exercise-level word note over the per-blank option note', () => {
    const note = buildAnswerNote({ ...base, wordNotes: { om: 'Bank-wide: yes/no only.' } });
    expect(note?.chosen?.note).toBe('Bank-wide: yes/no only.');
  });

  it('matches word notes case-insensitively and ignores padding', () => {
    const note = buildAnswerNote({ ...base, chosen: '  OM ', wordNotes: { om: 'Matched.' } });
    expect(note?.chosen?.note).toBe('Matched.');
  });

  it('says nothing for a blank left empty', () => {
    expect(buildAnswerNote({ ...base, chosen: '' })).toBeNull();
  });

  it('returns null when no prose is authored anywhere', () => {
    expect(buildAnswerNote({ chosen: 'om', correct: 'at', chosenCorrect: false })).toBeNull();
    expect(
      buildAnswerNote({
        rationale: { options: [{ text: 'at', verdict: 'correct' }] },
        chosen: 'at',
        correct: 'at',
        chosenCorrect: true,
      }),
    ).toBeNull();
  });

  it('is enough for a marker when only the explanation was written', () => {
    const note = buildAnswerNote({
      rationale: { explanation: 'Just the rule.' },
      chosen: 'at',
      correct: 'at',
      chosenCorrect: true,
    });
    expect(note?.explanation).toBe('Just the rule.');
  });
});
