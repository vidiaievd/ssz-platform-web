import { describe, expect, it } from 'vitest';

import { parseVocabularyBulkPaste } from './parse-vocabulary-bulk-paste';

describe('parseVocabularyBulkPaste', () => {
  it('parses tab-separated rows with an optional part-of-speech column', () => {
    expect(parseVocabularyBulkPaste('sykkel\tbicycle\tnoun\nsykle\tto cycle')).toEqual([
      { lemma: 'sykkel', translation: 'bicycle', partOfSpeech: 'noun' },
      { lemma: 'sykle', translation: 'to cycle', partOfSpeech: undefined },
    ]);
  });

  it('parses "lemma - translation" rows when there is no tab', () => {
    expect(parseVocabularyBulkPaste('sykkel - bicycle')).toEqual([
      { lemma: 'sykkel', translation: 'bicycle', partOfSpeech: undefined },
    ]);
  });

  it('trims cells and skips blank lines', () => {
    expect(parseVocabularyBulkPaste('\n  sykkel \t bicycle  \n\n')).toEqual([
      { lemma: 'sykkel', translation: 'bicycle', partOfSpeech: undefined },
    ]);
  });

  it('drops rows missing a lemma or translation', () => {
    expect(parseVocabularyBulkPaste('sykkel\t\n\tbicycle\nsykkel - bicycle')).toEqual([
      { lemma: 'sykkel', translation: 'bicycle', partOfSpeech: undefined },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseVocabularyBulkPaste('')).toEqual([]);
  });
});
