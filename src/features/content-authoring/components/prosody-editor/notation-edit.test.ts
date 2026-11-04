import { describe, expect, it } from 'vitest';

import { emptyProsodyLayer, layerOf, type ProsodyLayer } from '@/lib/shared-kernel/prosody';

import { lineAndColumn, readNotation, writeLayer } from './notation-edit';

const TEXT = 'Bartek har jobbet i tre år.';

describe('notation of the editor (plan 86, step 6h.3c)', () => {
  it('writes only the authored marks and reads them back as the teacher’s', () => {
    expect(writeLayer(TEXT, emptyProsodyLayer()).notation).toBe(TEXT);
    const read = readNotation(TEXT, "'0Bartek har '1jobbet i tre ^år \\ ||.", emptyProsodyLayer());
    // `år.` has no space before the dot, so the group end cannot be written there.
    expect(read.status).toBe('invalid');

    const ok = readNotation(
      'Bartek har jobbet i tre år',
      "'0Bartek har '1jobbet i tre ^år \\ ||",
      emptyProsodyLayer(),
    );
    expect(ok.status).toBe('ok');
    if (ok.status !== 'ok') return;
    expect(ok.layer.unstressed).toEqual([{ i: 0, w: 'Bartek', source: 'teacher' }]);
    expect(ok.layer.stresses).toMatchObject([{ i: 2, toneme: 1, source: 'teacher' }]);
    expect(ok.layer.accents).toEqual([{ i: 5, w: 'år', source: 'teacher' }]);
    expect(ok.layer.boundaries).toEqual([
      { i: 5, w: 'år', pitch: 'fall', pause: 'long', source: 'teacher' },
    ]);
    expect(writeLayer('Bartek har jobbet i tre år', ok.layer).notation).toBe(
      "'0Bartek har '1jobbet i tre ^år \\ ||",
    );
  });

  it('keeps the source and the vowel length of a mark left as it was', () => {
    const text = 'Han trives godt i Oslo';
    const current: ProsodyLayer = layerOf([
      { kind: 'boundary', mark: { i: 1, w: 'trives', pitch: null, pause: 'short', source: 'ai' } },
      {
        kind: 'stress',
        mark: { i: 4, w: 'Oslo', toneme: 1, vowel: { s: 0, e: 1, long: true }, source: 'teacher' },
      },
    ]);
    const { notation } = writeLayer(text, current);
    expect(notation).toBe("Han trives | godt i '1Oslo");

    // A new group end after «Oslo», and tone 2 instead of 1 on the same vowel.
    const read = readNotation(text, "Han trives | godt i '2Oslo \\", current);
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.layer.boundaries).toEqual([
      { i: 1, w: 'trives', pitch: null, pause: 'short', source: 'ai' },
      { i: 4, w: 'Oslo', pitch: 'fall', pause: null, source: 'teacher' },
    ]);
    expect(read.layer.stresses).toEqual([
      { i: 4, w: 'Oslo', toneme: 2, vowel: { s: 0, e: 1, long: true }, source: 'teacher' },
    ]);
  });

  it('carries the orphans and the marks the notation cannot write', () => {
    const text = 'Han kom.Neste dag';
    const orphan = {
      kind: 'accent' as const,
      mark: { i: 9, w: 'Kjetil', source: 'teacher' as const },
    };
    const current = layerOf(
      [
        {
          kind: 'boundary',
          mark: { i: 1, w: 'kom', pitch: 'fall', pause: null, source: 'teacher' },
        },
      ],
      [orphan],
    );
    const written = writeLayer(text, current);
    expect(written.notation).toBe(text);
    expect(written.kept).toHaveLength(1);

    const read = readNotation(text, '^Han kom.Neste dag', current);
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.layer.boundaries).toHaveLength(1);
    expect(read.layer.accents).toEqual([{ i: 0, w: 'Han', source: 'teacher' }]);
    expect(read.layer.orphans).toEqual([orphan]);
  });

  it('says where the notation went wrong', () => {
    const read = readNotation('Han kom\nNeste dag', 'Han kom\n\\ Neste dag', emptyProsodyLayer());
    expect(read.status).toBe('invalid');
    if (read.status !== 'invalid') return;
    expect(read.issues[0]).toMatchObject({ code: 'PN_MARKER_AT_LINE_START', at: 8 });
    expect(lineAndColumn('Han kom\n\\ Neste dag', 8)).toEqual({ line: 2, column: 1 });

    const changed = readNotation(TEXT, 'Bartek har jobba i tre år.', emptyProsodyLayer());
    expect(changed).toMatchObject({ status: 'invalid', issues: [{ code: 'PN_TEXT_MISMATCH' }] });
  });
});
