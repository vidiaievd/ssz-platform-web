import { describe, expect, it } from 'vitest';

import { sentenceAt, splitSentences } from './split-sentences';

describe('splitSentences', () => {
  it('splits on a plain full stop', () => {
    const text = 'Hun er sykepleier. Hun jobber om natten.';
    expect(splitSentences(text).map((s) => s.text)).toEqual([
      'Hun er sykepleier.',
      'Hun jobber om natten.',
    ]);
  });

  it('does not split inside an abbreviation', () => {
    const text = 'Vi kjøpte melk, brød o.l. i butikken. Så dro vi hjem.';
    expect(splitSentences(text).map((s) => s.text)).toEqual([
      'Vi kjøpte melk, brød o.l. i butikken.',
      'Så dro vi hjem.',
    ]);
  });

  it('keeps an abbreviation but still splits after the following number', () => {
    const text = 'Møtet er kl. 14. Vi ses der.';
    expect(splitSentences(text).map((s) => s.text)).toEqual(['Møtet er kl. 14.', 'Vi ses der.']);
  });

  it('does not split after an initial', () => {
    const text = 'Han heter A. Hansen. Han er lærer.';
    expect(splitSentences(text).map((s) => s.text)).toEqual(['Han heter A. Hansen.', 'Han er lærer.']);
  });

  it('does not split an ordinal followed by a lowercase word', () => {
    const text = 'Kurset starter 1. januar neste år.';
    expect(splitSentences(text)).toHaveLength(1);
  });

  it('returns a single segment when there is no terminal punctuation', () => {
    const text = 'Dette er en tekst uten punktum';
    expect(splitSentences(text).map((s) => s.text)).toEqual([text]);
  });

  it('splits on ! ? and ellipsis, and keeps closing quotes with the sentence', () => {
    const text = 'Hva sa du?! Han ropte «kom hit!» Så ble det stille...';
    expect(splitSentences(text).map((s) => s.text)).toEqual([
      'Hva sa du?!',
      'Han ropte «kom hit!»',
      'Så ble det stille...',
    ]);
  });

  it('reports offsets that slice back to the segment text', () => {
    const text = '  Hun er sykepleier. Hun jobber om natten. F.eks. om vinteren.  ';
    for (const sentence of splitSentences(text)) {
      expect(text.slice(sentence.start, sentence.end)).toBe(sentence.text);
      expect(sentence.text.trim()).toBe(sentence.text);
    }
  });
});

describe('sentenceAt', () => {
  const text = 'Hun er sykepleier. Hun jobber om natten.';
  const sentences = splitSentences(text);

  it('finds the sentence containing an offset', () => {
    expect(sentenceAt(sentences, text.indexOf('sykepleier'))).toBe('Hun er sykepleier.');
    expect(sentenceAt(sentences, text.indexOf('natten'))).toBe('Hun jobber om natten.');
  });

  it('falls back to the preceding sentence for an offset in the gap', () => {
    expect(sentenceAt(sentences, text.indexOf('sykepleier.') + 'sykepleier.'.length)).toBe(
      'Hun er sykepleier.',
    );
  });

  it('returns an empty string for no sentences', () => {
    expect(sentenceAt([], 0)).toBe('');
  });
});
