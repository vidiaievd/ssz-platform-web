import { describe, expect, it } from 'vitest';

import { splitParagraphs } from './split-paragraphs';

describe('splitParagraphs', () => {
  it('returns an empty array for blank input', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('   \n  ')).toEqual([]);
  });

  it('splits on one or more blank lines and trims each paragraph', () => {
    const body = '  Første avsnitt.  \n\nAndre avsnitt.\n\n\nTredje avsnitt.';
    expect(splitParagraphs(body)).toEqual([
      'Første avsnitt.',
      'Andre avsnitt.',
      'Tredje avsnitt.',
    ]);
  });

  it('drops empty paragraphs produced by excess blank lines', () => {
    expect(splitParagraphs('A\n\n\n\n\nB')).toEqual(['A', 'B']);
  });
});
