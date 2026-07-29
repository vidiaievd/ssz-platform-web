import { describe, expect, it } from 'vitest';

import { parseInlineMarkdown, sliceMarks } from './parse-inline-markdown';

describe('parseInlineMarkdown', () => {
  it('returns the text unchanged when there is no emphasis', () => {
    expect(parseInlineMarkdown('Bartek har jobbet som elektriker.')).toEqual({
      text: 'Bartek har jobbet som elektriker.',
      marks: [],
    });
  });

  it('strips a strong span and reports its offsets', () => {
    const { text, marks } = parseInlineMarkdown('**Erfaren elektriker søkes**');
    expect(text).toBe('Erfaren elektriker søkes');
    expect(marks).toEqual([{ start: 0, end: 24, kind: 'strong' }]);
  });

  it('locates emphasis in the middle of a line', () => {
    const { text, marks } = parseInlineMarkdown('Vi tilbyr **et godt arbeidsmiljø** til alle.');
    expect(text).toBe('Vi tilbyr et godt arbeidsmiljø til alle.');
    expect(marks).toEqual([{ start: 10, end: 30, kind: 'strong' }]);
    expect(text.slice(10, 30)).toBe('et godt arbeidsmiljø');
  });

  it('distinguishes em from strong', () => {
    const { text, marks } = parseInlineMarkdown('Han er *veldig* ivrig.');
    expect(text).toBe('Han er veldig ivrig.');
    expect(marks).toEqual([{ start: 7, end: 13, kind: 'em' }]);
  });

  it('handles em nested inside strong', () => {
    const { text, marks } = parseInlineMarkdown('**Vi ønsker *virkelig* deg**');
    expect(text).toBe('Vi ønsker virkelig deg');
    expect(marks).toEqual([
      { start: 0, end: 22, kind: 'strong' },
      { start: 10, end: 18, kind: 'em' },
    ]);
    expect(text.slice(10, 18)).toBe('virkelig');
  });

  it('handles several spans on one line', () => {
    const { text, marks } = parseInlineMarkdown('**A** og **B**');
    expect(text).toBe('A og B');
    expect(marks).toEqual([
      { start: 0, end: 1, kind: 'strong' },
      { start: 5, end: 6, kind: 'strong' },
    ]);
  });

  it('leaves an unmatched delimiter in the text', () => {
    expect(parseInlineMarkdown('5 * 3 = 15')).toEqual({ text: '5 * 3 = 15', marks: [] });
    expect(parseInlineMarkdown('**uavsluttet')).toEqual({ text: '**uavsluttet', marks: [] });
  });

  it('does not treat an empty delimiter pair as emphasis', () => {
    expect(parseInlineMarkdown('a ** b')).toEqual({ text: 'a ** b', marks: [] });
  });

  it('leaves underscores alone', () => {
    expect(parseInlineMarkdown('media_id_1')).toEqual({ text: 'media_id_1', marks: [] });
  });
});

describe('sliceMarks', () => {
  const marks = parseInlineMarkdown('**Erfaren elektriker** søkes').marks;

  it('reports a fully covered range as one emphasised piece', () => {
    expect(sliceMarks(marks, 0, 7)).toEqual([{ start: 0, end: 7, kinds: ['strong'] }]);
  });

  it('reports an uncovered range as one plain piece', () => {
    expect(sliceMarks(marks, 22, 27)).toEqual([{ start: 22, end: 27, kinds: [] }]);
  });

  it('cuts a range that straddles the mark boundary', () => {
    expect(sliceMarks(marks, 15, 25)).toEqual([
      { start: 15, end: 18, kinds: ['strong'] },
      { start: 18, end: 25, kinds: [] },
    ]);
  });

  it('reports nested marks on the overlapping piece', () => {
    const nested = parseInlineMarkdown('**Vi *vil* ha**').marks;
    expect(sliceMarks(nested, 3, 6)).toEqual([{ start: 3, end: 6, kinds: ['strong', 'em'] }]);
  });
});
