import { describe, expect, it } from 'vitest';

import type { VocabularyForm, VocabularyItem } from '@/features/content/types';
import { buildGlossaryIndex, tokenizeGlossary } from './tokenize-glossary';

function item(id: string, lemma: string, forms?: VocabularyForm[]): VocabularyItem {
  return { id, lemma, translations: [], examples: [], forms };
}

describe('buildGlossaryIndex + tokenizeGlossary', () => {
  it('returns a single untagged token when there is no glossary', () => {
    const tokens = tokenizeGlossary('Hun jobber på sykehuset.', buildGlossaryIndex([]));
    expect(tokens).toEqual([{ id: 0, text: 'Hun jobber på sykehuset.', start: 0, entry: null }]);
  });

  it('tags exact-match occurrences case-insensitively', () => {
    const sykepleier = item('v1', 'sykepleier');
    const index = buildGlossaryIndex([sykepleier]);
    const tokens = tokenizeGlossary('Sykepleier jobber. En sykepleier til.', index);
    const tagged = tokens.filter((t) => t.entry);
    expect(tagged).toHaveLength(2);
    expect(tagged.every((t) => t.entry?.item === sykepleier)).toBe(true);
  });

  it('matches an inflected form and reports its label, keeping the source casing', () => {
    const sykepleier = item('v1', 'sykepleier', [
      { label: 'Bestemt entall', value: 'sykepleieren' },
    ]);
    const index = buildGlossaryIndex([sykepleier]);
    const tokens = tokenizeGlossary('Sykepleieren jobber her.', index);

    const tagged = tokens.filter((t) => t.entry);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]!.text).toBe('Sykepleieren');
    expect(tagged[0]!.entry?.item).toBe(sykepleier);
    expect(tagged[0]!.entry?.formLabel).toBe('Bestemt entall');
    expect(tagged[0]!.entry?.form).toBe('sykepleieren');
  });

  it('reports a null form label when the lemma itself matched', () => {
    const index = buildGlossaryIndex([
      item('v1', 'sykepleier', [{ label: 'Bestemt entall', value: 'sykepleieren' }]),
    ]);
    const tokens = tokenizeGlossary('En sykepleier.', index);
    expect(tokens.find((t) => t.entry)?.entry?.formLabel).toBeNull();
  });

  it('does not match a lemma inside a longer word', () => {
    const index = buildGlossaryIndex([item('v1', 'er')]);
    const tokens = tokenizeGlossary('Hun har et stort hjerte.', index);
    expect(tokens.every((t) => t.entry === null)).toBe(true);
  });

  it('does not match a lemma across a Norwegian letter boundary', () => {
    const index = buildGlossaryIndex([item('v1', 'å')]);
    const tokens = tokenizeGlossary('Han bor på landet.', index);
    expect(tokens.every((t) => t.entry === null)).toBe(true);
  });

  it('matches a lemma containing Norwegian letters at word boundaries', () => {
    const blå = item('v1', 'blå');
    const tokens = tokenizeGlossary('en blå bil', buildGlossaryIndex([blå]));
    const tagged = tokens.filter((t) => t.entry);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]!.text).toBe('blå');
  });

  it('prefers the longest lemma when one is a prefix of another', () => {
    const gå = item('v1', 'gå');
    const gåUt = item('v2', 'gå ut');
    const index = buildGlossaryIndex([gå, gåUt]);
    const tokens = tokenizeGlossary('vi gå ut på tur', index);
    const tagged = tokens.filter((t) => t.entry);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]!.text).toBe('gå ut');
    expect(tagged[0]!.entry?.item).toBe(gåUt);
  });

  it('leaves non-matching words untagged', () => {
    const index = buildGlossaryIndex([item('v1', 'sykepleier')]);
    const tokens = tokenizeGlossary('En vanlig arbeidsdag.', index);
    expect(tokens.every((t) => t.entry === null)).toBe(true);
  });

  it('lets a lemma win over another item’s identical form', () => {
    const hus = item('v1', 'hus');
    const huse = item('v2', 'huse', [{ label: 'Presens', value: 'hus' }]);
    const index = buildGlossaryIndex([hus, huse]);
    const tokens = tokenizeGlossary('Et hus.', index);
    const tagged = tokens.filter((t) => t.entry);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]!.entry?.item).toBe(hus);
    expect(tagged[0]!.entry?.formLabel).toBeNull();
  });

  it('skips blank form values', () => {
    const index = buildGlossaryIndex([item('v1', 'hus', [{ label: 'Tom', value: '   ' }])]);
    expect(index.size).toBe(1);
  });

  it('keeps offsets that reconstruct the source text', () => {
    const text = 'Sykepleieren jobber, og en sykepleier til jobber her.';
    const index = buildGlossaryIndex([
      item('v1', 'sykepleier', [{ label: 'Bestemt entall', value: 'sykepleieren' }]),
      item('v2', 'jobbe', [{ label: 'Presens', value: 'jobber' }]),
    ]);
    const tokens = tokenizeGlossary(text, index);

    expect(tokens.map((t) => t.text).join('')).toBe(text);
    for (const token of tokens) {
      expect(text.slice(token.start, token.start + token.text.length)).toBe(token.text);
    }
  });
});
