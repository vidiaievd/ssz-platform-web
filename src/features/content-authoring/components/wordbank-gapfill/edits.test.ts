import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, gaps, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import {
  applySentenceText,
  explanationCount,
  extractBrackets,
  moveSentence,
  removeSentence,
  sentencesFromPaste,
  toggleGap,
} from './edits';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: 'På kafé',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [
      { id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] },
      { id: 's2', text: 'Kan jeg få regningen, takk?', gaps: [3] },
    ],
    distractors: ['bestilt'],
    feedback: {
      's1#3': {
        fallback: 'Verbet mangler.',
        why: 'Etter «vil gjerne» kommer infinitiv.',
        pairs: { bestilt: { text: 'Perfektum passer ikke her.', origin: 'author' } },
      },
    },
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('extractBrackets', () => {
  it('leaves text alone when there are no brackets, spacing included', () => {
    expect(extractBrackets('Jeg vil  gjerne ')).toEqual({ text: 'Jeg vil  gjerne ', gaps: [] });
  });

  it('strips the brackets and reports the token index', () => {
    expect(extractBrackets('Jeg vil gjerne [bestille] en kaffe.')).toEqual({
      text: 'Jeg vil gjerne bestille en kaffe.',
      gaps: [3],
    });
  });

  it('keeps punctuation that sits outside the brackets (AC-B3)', () => {
    const { text, gaps: marked } = extractBrackets('Kan jeg få [regningen], takk?');
    expect(text).toBe('Kan jeg få regningen, takk?');
    expect(marked).toEqual([3]);
  });
});

describe('applySentenceText', () => {
  it('marks a bracketed word and derives the answer without its comma (AC-B3)', () => {
    const next = applySentenceText(doc(), 's2', 'Kan jeg få [regningen], takk?');
    const gap = gaps(next).find((candidate) => candidate.sentenceId === 's2');

    expect(next.sentences[1]?.text).toBe('Kan jeg få regningen, takk?');
    expect(gap?.answer).toBe('regningen');
  });

  it('drops a gap the shortened text no longer reaches, with its feedback (AC-B5)', () => {
    const next = applySentenceText(doc(), 's1', 'Jeg vil');

    expect(next.sentences[0]?.gaps).toEqual([]);
    expect(next.feedback['s1#3']).toBeUndefined();
  });

  it('keeps the explanations of gaps that survive the edit', () => {
    const next = applySentenceText(doc(), 's1', 'Jeg vil gjerne bestille en kaffe i dag.');

    expect(next.feedback['s1#3']?.fallback).toBe('Verbet mangler.');
  });

  it('does not normalise whitespace while the teacher is still typing', () => {
    const next = applySentenceText(doc(), 's1', 'Jeg vil gjerne bestille en kaffe. ');

    expect(next.sentences[0]?.text).toBe('Jeg vil gjerne bestille en kaffe. ');
  });
});

describe('toggleGap', () => {
  it('turns a token into a gap (AC-B1)', () => {
    const next = toggleGap(doc(), 's2', 2);

    expect(gaps(next).map((gap) => gap.answer)).toEqual(['bestille', 'få', 'regningen']);
  });

  it('removes the gap and its explanations (AC-B2)', () => {
    const next = toggleGap(doc(), 's1', 3);

    expect(next.sentences[0]?.gaps).toEqual([]);
    expect(next.feedback['s1#3']).toBeUndefined();
  });
});

describe('removeSentence', () => {
  it('takes the sentence and its feedback out', () => {
    const next = removeSentence(doc(), 's1');

    expect(next.sentences.map((sentence) => sentence.id)).toEqual(['s2']);
    expect(next.feedback['s1#3']).toBeUndefined();
  });
});

describe('moveSentence', () => {
  it('renumbers the labels by document order and loses nothing (AC-B7)', () => {
    const before = gaps(doc());
    expect(before.map((gap) => `${gap.label}:${gap.answer}`)).toEqual([
      'G1:bestille',
      'G2:regningen',
    ]);

    const next = moveSentence(doc(), 1, -1);

    expect(gaps(next).map((gap) => `${gap.label}:${gap.answer}`)).toEqual([
      'G1:regningen',
      'G2:bestille',
    ]);
    expect(next.feedback['s1#3']?.fallback).toBe('Verbet mangler.');
  });

  it('is a no-op past either end', () => {
    expect(moveSentence(doc(), 0, -1).sentences).toEqual(doc().sentences);
    expect(moveSentence(doc(), 1, 1).sentences).toEqual(doc().sentences);
  });
});

describe('sentencesFromPaste', () => {
  it('makes one sentence per line with the brackets already marked (AC-B4)', () => {
    const made = sentencesFromPaste(
      '  Jeg vil gjerne [bestille] en kaffe.\n\nKan jeg få [regningen], takk?\n',
    );

    expect(made).toHaveLength(2);
    expect(made[0]).toMatchObject({ text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] });
    expect(made[1]).toMatchObject({ text: 'Kan jeg få regningen, takk?', gaps: [3] });
    expect(made[0]?.id).not.toBe(made[1]?.id);
  });
});

describe('explanationCount', () => {
  it('counts the default, the why and every authored pair', () => {
    expect(explanationCount(doc(), 's1#3')).toBe(3);
  });

  it('ignores blank text and unaccepted AI drafts', () => {
    const ex = doc({
      feedback: {
        's1#3': {
          fallback: '   ',
          why: '',
          pairs: { bestilt: { text: 'Draft.', origin: 'ai_draft' } },
        },
      },
    });

    expect(explanationCount(ex, 's1#3')).toBe(0);
  });

  it('is zero for a gap nobody has written about', () => {
    expect(explanationCount(doc(), 's2#3')).toBe(0);
  });
});
