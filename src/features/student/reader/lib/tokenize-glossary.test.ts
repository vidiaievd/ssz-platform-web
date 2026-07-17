import { describe, expect, it } from 'vitest';

import type { VocabularyItem } from '@/features/content/types';
import { buildGlossaryIndex, tokenizeGlossary } from './tokenize-glossary';

function item(id: string, lemma: string): VocabularyItem {
  return { id, lemma, translations: [], examples: [] };
}

describe('buildGlossaryIndex + tokenizeGlossary', () => {
  it('returns a single untagged token when there is no glossary', () => {
    const tokens = tokenizeGlossary('Hun jobber på sykehuset.', buildGlossaryIndex([]));
    expect(tokens).toEqual([{ id: 0, text: 'Hun jobber på sykehuset.', item: null }]);
  });

  it('tags exact-match occurrences case-insensitively', () => {
    const sykepleier = item('v1', 'sykepleier');
    const index = buildGlossaryIndex([sykepleier]);
    const tokens = tokenizeGlossary('Sykepleier jobber. En sykepleier til.', index);
    const tagged = tokens.filter((t) => t.item);
    expect(tagged).toHaveLength(2);
    expect(tagged.every((t) => t.item === sykepleier)).toBe(true);
  });

  it('prefers the longest lemma when one is a substring of another', () => {
    const jobbe = item('v1', 'jobbe');
    const jobbeMed = item('v2', 'jobbe med');
    const index = buildGlossaryIndex([jobbe, jobbeMed]);
    const tokens = tokenizeGlossary('Jeg liker å jobbe med data.', index);
    const tagged = tokens.filter((t) => t.item);
    expect(tagged).toEqual([{ id: expect.any(Number), text: 'jobbe med', item: jobbeMed }]);
  });

  it('leaves non-matching words untagged', () => {
    const index = buildGlossaryIndex([item('v1', 'sykepleier')]);
    const tokens = tokenizeGlossary('En vanlig arbeidsdag.', index);
    expect(tokens.every((t) => t.item === null)).toBe(true);
  });
});
