import { describe, expect, it } from 'vitest';

import { expectValidSourceMap } from '@/test/source-map';

import { parseInlineMarkdown, sliceMarks } from './parse-inline-markdown';

/**
 * The emphasis fixtures below assert `{ text, marks }` as a whole. The offset
 * map is a third, much noisier field whose contract is checked by its own
 * property test, so it is dropped here rather than spelled out in every case.
 */
function withoutMap(raw: string) {
  const { text, marks } = parseInlineMarkdown(raw);
  return { text, marks };
}

describe('parseInlineMarkdown', () => {
  it('returns the text unchanged when there is no emphasis', () => {
    expect(withoutMap('Bartek har jobbet som elektriker.')).toEqual({
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
    expect(withoutMap('5 * 3 = 15')).toEqual({ text: '5 * 3 = 15', marks: [] });
    expect(withoutMap('**uavsluttet')).toEqual({ text: '**uavsluttet', marks: [] });
  });

  it('does not treat an empty delimiter pair as emphasis', () => {
    expect(withoutMap('a ** b')).toEqual({ text: 'a ** b', marks: [] });
  });

  it('leaves underscores alone', () => {
    expect(withoutMap('media_id_1')).toEqual({ text: 'media_id_1', marks: [] });
  });
});

describe('parseInlineMarkdown source map', () => {
  // The emphasis fixtures this suite already exercises, reused as the property
  // test's corpus per spec 16 §8 obligation 10.
  const FIXTURES = [
    'Bartek har jobbet som elektriker.',
    '**Erfaren elektriker søkes**',
    'Vi tilbyr **et godt arbeidsmiljø** til alle.',
    'Han er *veldig* ivrig.',
    '**Vi ønsker *virkelig* deg**',
    '**A** og **B**',
    '5 * 3 = 15',
    '**uavsluttet',
    'a ** b',
    'media_id_1',
    '',
    '**',
    '*a**b*',
    'Søknad **med *CV*** sendes til post@nordbyelektro.no innen 15. mars.',
  ];

  it.each(FIXTURES)('maps every output character back into %j', (raw) => {
    expectValidSourceMap(raw, parseInlineMarkdown(raw));
  });

  it('projects a stripped-text range onto the delimiters it came from', () => {
    const raw = 'Vi tilbyr **et godt arbeidsmiljø** til alle.';
    const { text, sourceIndexOf } = parseInlineMarkdown(raw);

    // "arbeidsmiljø" sits inside the strong span; its raw offsets must skip the
    // two leading asterisks the reader never sees. The exclusive end is one
    // past the *last included* character, not `sourceIndexOf[end]` — see the
    // warning on `InlineMarkdown.sourceIndexOf`.
    const start = text.indexOf('arbeidsmiljø');
    const end = start + 'arbeidsmiljø'.length;
    expect(raw.slice(sourceIndexOf[start]!, sourceIndexOf[end - 1]! + 1)).toBe('arbeidsmiljø');
  });

  it('does not let a sub-range end swallow the markup that follows it', () => {
    const raw = 'Vi tilbyr **et godt arbeidsmiljø** til alle.';
    const { text, sourceIndexOf } = parseInlineMarkdown(raw);
    const end = text.indexOf('arbeidsmiljø') + 'arbeidsmiljø'.length;

    // The word ends flush against the closing `**`, so the next output
    // character is the space *after* the delimiters. Reading the entry at `end`
    // as the exclusive end would silently annotate two asterisks as well.
    expect(sourceIndexOf[end]).toBe(raw.indexOf('** til') + 2);
    expect(sourceIndexOf[end - 1]! + 1).toBe(raw.indexOf('** til'));
  });

  it('places the exclusive end past the closing delimiter of a trailing span', () => {
    const raw = '**Erfaren elektriker søkes**';
    const { text, sourceIndexOf } = parseInlineMarkdown(raw);
    expect(sourceIndexOf[text.length]).toBe(raw.length);
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
