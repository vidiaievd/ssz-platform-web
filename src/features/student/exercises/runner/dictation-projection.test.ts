import { describe, expect, it } from 'vitest';

import { readDictationProjection } from './dictation-projection';

const PROJECTION = {
  instruction: 'Hør på opptaket og skriv setningene.',
  mode: 'segments',
  segments: [{ id: 's1' }, { id: 's2', wordCount: 4 }],
  settings: { attempts: 2, hints: true, revealKey: true, showWordCount: true },
  audio: { enabled: true, segments: { s1: { start: 0, end: 7 } } },
};

describe('readDictationProjection', () => {
  it('reads the student projection field by field', () => {
    expect(readDictationProjection(PROJECTION)).toEqual({
      instruction: 'Hør på opptaket og skriv setningene.',
      mode: 'segments',
      segments: [{ id: 's1' }, { id: 's2', wordCount: 4 }],
      settings: { attempts: 2, hints: true, revealKey: true, showWordCount: true },
    });
  });

  it.each(['orphans', 'marking', 'threshold', 'language', 'transcript'])(
    'refuses a document with «%s» at its root — that is the stored copy (AC-X2)',
    (field) => {
      expect(readDictationProjection({ ...PROJECTION, [field]: {} })).toBeNull();
    },
  );

  it.each(['text', 'why', 'focus'])('refuses a segment carrying «%s» (AC-X2)', (field) => {
    expect(
      readDictationProjection({ ...PROJECTION, segments: [{ id: 's1', [field]: 'x' }] }),
    ).toBeNull();
  });

  it('refuses settings carrying the pass mark (deviation 15)', () => {
    expect(
      readDictationProjection({
        ...PROJECTION,
        settings: { ...PROJECTION.settings, threshold: 80 },
      }),
    ).toBeNull();
  });

  it('refuses what is not a projection at all', () => {
    expect(readDictationProjection(null)).toBeNull();
    expect(readDictationProjection([])).toBeNull();
    expect(readDictationProjection({ instruction: '' })).toBeNull();
    expect(readDictationProjection({ ...PROJECTION, segments: [{ id: '' }] })).toBeNull();
  });

  it('reads a word count it was not meant to give as no count (AC-R3)', () => {
    const read = readDictationProjection({
      ...PROJECTION,
      segments: [
        { id: 's1', wordCount: 0 },
        { id: 's2', wordCount: 'four' },
      ],
    });
    expect(read?.segments).toEqual([{ id: 's1' }, { id: 's2' }]);
  });

  it('reads an unknown budget as unlimited and an unknown mode as sentence by sentence', () => {
    const read = readDictationProjection({
      ...PROJECTION,
      mode: 'paragraphs',
      settings: { attempts: 7 },
    });
    expect(read?.mode).toBe('segments');
    expect(read?.settings).toEqual({
      attempts: 0,
      hints: false,
      revealKey: false,
      showWordCount: false,
    });
  });
});
