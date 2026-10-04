import { describe, expect, it } from 'vitest';

import { toStudentProjection } from '@/lib/shared-kernel/highlight-in-text';

import { readHighlightInTextProjection } from './highlight-in-text-projection';

const TEXT = 'I fjor sommer reiste vi til Bodø.\n\nDet var kaldt.';

const CONTENT = {
  title: 'Sommer',
  instruction: 'Les teksten.',
  text: TEXT,
  questions: [
    { id: 'q1', prompt: 'Finn verbene i preteritum.', unit: 'word' },
    { id: 'q2', prompt: 'Finn tidsuttrykket.', unit: 'phrase' },
  ],
  settings: {
    attempts: 2,
    threshold: 70,
    penalty: 'half',
    showCount: true,
    hints: true,
    revealKey: true,
  },
};

const ANSWERS = {
  questions: {
    q1: {
      spans: [{ id: 's1', start: 14, end: 20, why: 'reise → reiste' }],
      missHint: 'Se etter -te.',
      fpHint: '',
    },
    q2: {
      spans: [{ id: 's2', start: 0, end: 13, why: '' }],
      missHint: 'Når?',
      fpHint: '',
    },
  },
  orphans: [],
};

const projected = () => toStudentProjection(CONTENT, ANSWERS);

describe('readHighlightInTextProjection', () => {
  it('accepts what the kernel projects, field for field', () => {
    const read = readHighlightInTextProjection(JSON.parse(JSON.stringify(projected())));
    expect(read).toEqual(projected());
    expect(read?.questions.map((q) => q.count)).toEqual([1, 1]);
  });

  it('accepts a projection with the audio layer on it', () => {
    expect(
      readHighlightInTextProjection({ ...projected(), audio: { enabled: false } }),
    ).not.toBeNull();
  });

  it.each([
    ['spans', { spans: [] }],
    ['orphans', { orphans: [] }],
    ['threshold', { threshold: 70 }],
    ['penalty', { penalty: 'half' }],
  ])('refuses a root carrying %s (AC-S11)', (_name, extra) => {
    expect(readHighlightInTextProjection({ ...projected(), ...extra })).toBeNull();
  });

  it.each(['spans', 'why', 'missHint', 'fpHint'])(
    'refuses a question carrying %s (AC-S11)',
    (field) => {
      const p = projected();
      const leaked = { ...p, questions: [{ ...p.questions[0], [field]: 'x' }] };
      expect(readHighlightInTextProjection(leaked)).toBeNull();
    },
  );

  it.each(['threshold', 'penalty', 'showCount'])('refuses settings carrying %s', (field) => {
    const p = projected();
    expect(
      readHighlightInTextProjection({ ...p, settings: { ...p.settings, [field]: 1 } }),
    ).toBeNull();
  });

  it('refuses the stored document itself', () => {
    expect(readHighlightInTextProjection(CONTENT)).toBeNull();
  });

  it('reads a count the projection did not mean to give as no count (AC-S10)', () => {
    const p = projected();
    const read = readHighlightInTextProjection({
      ...p,
      questions: [
        { ...p.questions[0], count: null },
        { ...p.questions[1], count: 0 },
      ],
    });
    expect(read?.questions.map((q) => q.count)).toEqual([null, null]);
  });

  it('refuses a question without a prompt, and anything that is not an object', () => {
    const p = projected();
    expect(
      readHighlightInTextProjection({ ...p, questions: [{ ...p.questions[0], prompt: ' ' }] }),
    ).toBeNull();
    expect(readHighlightInTextProjection(null)).toBeNull();
    expect(readHighlightInTextProjection([])).toBeNull();
    expect(readHighlightInTextProjection({ questions: [] })).toBeNull();
  });
});
