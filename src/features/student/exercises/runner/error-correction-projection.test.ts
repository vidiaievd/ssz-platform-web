import { describe, expect, it } from 'vitest';

import { readStudentProjection } from './error-correction-projection';

const PROJECTED = {
  mode: 'sentences',
  note: '',
  items: [
    {
      id: 'i1',
      wrong: 'I går jeg gikk på kino.',
      words: ['I', 'går', 'jeg', 'gikk', 'på', 'kino.'],
      errorCount: 1,
    },
  ],
  hints: { count: true, mark: false, hintText: true, showType: false },
  flow: {
    selfCheck: 2,
    attempts: 'free',
    showRefs: 'afterGraded',
    keyboard: true,
    showSpanCount: true,
  },
  totalErrors: 1,
};

/** The stored document, as an engine that never learned to mask would hand it over. */
const UNMASKED = {
  mode: 'sentences',
  note: '',
  items: [{ id: 'i1', wrong: 'I går jeg gikk på kino.', hint: '' }],
  hints: { count: true, mark: false, hintText: true, showType: false },
  check: { on: true },
  flow: { selfCheck: 2 },
  ai: { on: false },
};

describe('readStudentProjection', () => {
  it('takes the masked projection as it is', () => {
    expect(readStudentProjection(PROJECTED)).toMatchObject({
      mode: 'sentences',
      totalErrors: 1,
    });
  });

  // Not a small gap to tokenise around: only the masking adds `words`, so its absence
  // means the server also shipped the answer key.
  it('refuses a document that was never masked', () => {
    expect(readStudentProjection(UNMASKED)).toBeNull();
  });

  it('refuses anything that is not an exercise at all', () => {
    expect(readStudentProjection(null)).toBeNull();
    expect(readStudentProjection('nope')).toBeNull();
    expect(readStudentProjection({ mode: 'sentences', items: 'no' })).toBeNull();
    expect(readStudentProjection({ ...PROJECTED, mode: 'chunks' })).toBeNull();
  });

  it('fills in settings that went missing, since those only arrange the screen', () => {
    const partial = readStudentProjection({ ...PROJECTED, flow: { selfCheck: 0 } });

    // What the payload said is kept; what it left out falls back to the author defaults
    // rather than to `undefined`, which is what the runner would read as "off".
    expect(partial?.flow.selfCheck).toBe(0);
    expect(partial?.flow.keyboard).toBe(true);
    expect(readStudentProjection({ ...PROJECTED, note: 42 })?.note).toBe('');
  });
});
