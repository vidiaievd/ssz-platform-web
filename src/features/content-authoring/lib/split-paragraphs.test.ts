import { describe, expect, it } from 'vitest';

import { splitParagraphs, splitParagraphsWithOffsets } from './split-paragraphs';

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

describe('splitParagraphsWithOffsets', () => {
  it('returns an empty array for blank input', () => {
    expect(splitParagraphsWithOffsets('')).toEqual([]);
    expect(splitParagraphsWithOffsets('   \n  ')).toEqual([]);
  });

  it('reports offsets that slice the body back to each paragraph', () => {
    const body = '  Første avsnitt.  \n\nAndre avsnitt.\n\n\nTredje avsnitt.';

    for (const p of splitParagraphsWithOffsets(body)) {
      expect(body.slice(p.bodyStart, p.bodyEnd)).toBe(p.text);
    }
  });

  it('points past the whitespace a trimmed paragraph shed', () => {
    const [first] = splitParagraphsWithOffsets('  Første avsnitt.  \n\nAndre.');

    expect(first).toEqual({
      index: 0,
      text: 'Første avsnitt.',
      bodyStart: 2,
      bodyEnd: 17,
    });
  });

  it('numbers paragraphs after dropping the empty ones', () => {
    // Leading blank lines make String.split emit an empty first chunk; it must
    // not consume index 0, or every span in the body anchors one paragraph off.
    const spans = splitParagraphsWithOffsets('\n\nFirst.\n\nSecond.');

    expect(spans.map((p) => [p.index, p.text])).toEqual([
      [0, 'First.'],
      [1, 'Second.'],
    ]);
  });

  it('agrees with splitParagraphs on the text', () => {
    const body = '\n\n  A soft\nwrapped one.  \n\n\n   \n\nB.\n\n';

    expect(splitParagraphsWithOffsets(body).map((p) => p.text)).toEqual(splitParagraphs(body));
  });
});
