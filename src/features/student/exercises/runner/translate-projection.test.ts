import { describe, expect, it } from 'vitest';

import { DEFAULT_FLOW } from '@/lib/shared-kernel/translate';

import { readTranslateProjection } from './translate-projection';

const PROJECTED = {
  dir: 'to_target',
  langs: { explain: 'Russisk', target: 'Norsk' },
  format: 'set',
  note: 'Bruk perfektum.',
  items: [
    {
      id: 'i1',
      dir: 'to_target',
      source: 'Я живу в Тромсё три года.',
      sourceLang: 'Russisk',
      answerLang: 'Norsk',
      hint: 'har bodd',
      gloss: [{ w: 'уже', t: 'allerede' }],
    },
  ],
  flow: { ...DEFAULT_FLOW },
  exactPasses: true,
};

describe('readTranslateProjection', () => {
  it('accepts the masked projection and keeps its sentences', () => {
    const projection = readTranslateProjection(PROJECTED);

    expect(projection?.items).toHaveLength(1);
    expect(projection?.items[0]?.source).toBe('Я живу в Тромсё три года.');
    expect(projection?.exactPasses).toBe(true);
  });

  it('fills in flow settings the projection did not carry, from the kernel defaults', () => {
    const projection = readTranslateProjection({ ...PROJECTED, flow: { selfCheck: 4 } });

    expect(projection?.flow.selfCheck).toBe(4);
    expect(projection?.flow.keyboard).toBe(DEFAULT_FLOW.keyboard);
    expect(projection?.flow.showRefs).toBe(DEFAULT_FLOW.showRefs);
  });

  it('refuses the stored document, which arrives only when the server did not project', () => {
    // The same sentences as they sit in `content`: no resolved languages, no routing
    // rule — and, on the wire, `expectedAnswers` next to them.
    const stored = {
      dir: 'to_target',
      langs: { explain: 'Russisk', target: 'Norsk' },
      format: 'set',
      note: '',
      items: [{ id: 'i1', dir: 'to_target', source: 'Я живу в Тромсё три года.', gloss: [] }],
      flow: { ...DEFAULT_FLOW },
    };

    expect(readTranslateProjection(stored)).toBeNull();
  });

  it('refuses a projection with no sentences to translate', () => {
    expect(readTranslateProjection({ ...PROJECTED, items: [] })).toBeNull();
  });

  it('refuses anything that is not a projection at all', () => {
    expect(readTranslateProjection(null)).toBeNull();
    expect(readTranslateProjection('nope')).toBeNull();
    expect(readTranslateProjection({})).toBeNull();
  });
});
