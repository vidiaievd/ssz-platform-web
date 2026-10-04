import { describe, expect, it } from 'vitest';

import { emptyContent, newSegment, type DictationContent } from '@/lib/shared-kernel/dictation';

import {
  addSegment,
  applySplit,
  audioDraftOf,
  removeSegment,
  setMode,
  setSegmentText,
  setTimecodeEdge,
  setTitle,
  withAudioDraft,
  type DictationDocument,
} from './edits';

const doc = (patch: Partial<DictationDocument> = {}): DictationDocument => ({
  ...emptyContent('nb'),
  updatedAt: '2026-10-04T10:00:00.000Z',
  ...patch,
});

describe('the wrappers keep what the kernel does not know', () => {
  it('carries the autosave token through an edit', () => {
    const next = setTitle(doc(), 'Diktat');
    expect(next.title).toBe('Diktat');
    expect(next.updatedAt).toBe('2026-10-04T10:00:00.000Z');
  });
});

describe('the audio block', () => {
  it('is read as a draft with no timecode map — a dictation keeps them on its segments', () => {
    expect(audioDraftOf(doc())).toMatchObject({ segments: {}, present: true });
  });

  it('can never be switched off — «audio is on and cannot be turned off»', () => {
    const draft = audioDraftOf(doc());
    const next = withAudioDraft(doc(), { ...draft, audio: { ...draft.audio, enabled: false } });
    expect(next.audio.enabled).toBe(true);
  });

  it('writes a title and a length from the source card', () => {
    const draft = audioDraftOf(doc());
    const next = withAudioDraft(doc(), {
      ...draft,
      audio: { ...draft.audio, title: 'Kjøkkenet', duration: 42 },
    });
    expect(next.audio).toMatchObject({ title: 'Kjøkkenet', duration: 42 });
  });
});

describe('setTimecodeEdge — «Set start here» / «Set end» (AC-B3)', () => {
  const withSegment = (audio: { start: number; end: number } | null) => {
    const seg = { ...newSegment(), audio };
    return { ex: doc({ segments: [seg] }), id: seg.id };
  };

  it('takes the player position as the start and keeps the end', () => {
    const { ex, id } = withSegment({ start: 3, end: 19 });
    expect(setTimecodeEdge(ex, id, 'start', 12).segments[0]?.audio).toEqual({ start: 12, end: 19 });
  });

  it('keeps a tenth of a second, so an end does not cut the last word short', () => {
    const { ex, id } = withSegment({ start: 3, end: 19 });
    expect(setTimecodeEdge(ex, id, 'end', 17.64).segments[0]?.audio).toEqual({ start: 3, end: 17.6 });
    expect(setTimecodeEdge(ex, id, 'end', 5.46).segments[0]?.audio).toEqual({ start: 3, end: 5.5 });
  });

  it('with no timecode yet, a start is the whole pair until the end is set', () => {
    const { ex, id } = withSegment(null);
    expect(setTimecodeEdge(ex, id, 'start', 12).segments[0]?.audio).toEqual({ start: 12, end: 12 });
  });

  it('with no timecode yet, an end starts from the top of the clip', () => {
    const { ex, id } = withSegment(null);
    expect(setTimecodeEdge(ex, id, 'end', 7).segments[0]?.audio).toEqual({ start: 0, end: 7 });
  });

  it('ignores a segment that is gone', () => {
    const { ex } = withSegment(null);
    expect(setTimecodeEdge(ex, 'nope', 'start', 4)).toBe(ex);
  });
});

describe('segments', () => {
  it('adds one and says which, until the ceiling of eight', () => {
    let ex = doc();
    for (let i = 0; i < 7; i++) {
      const added = addSegment(ex);
      expect(added.added).toBe(added.ex.segments.at(-1)?.id);
      ex = added.ex;
    }
    expect(ex.segments).toHaveLength(8);
    expect(addSegment(ex)).toEqual({ ex, added: null });
  });

  it('removes one, but never the last', () => {
    const two = addSegment(doc()).ex;
    const [first, second] = two.segments;
    const one = removeSegment(two, first!.id);
    expect(one.segments.map((s) => s.id)).toEqual([second!.id]);
    expect(removeSegment(one, second!.id).segments).toEqual(one.segments);
  });

  it("re-anchors a focus word when its sentence is edited — the kernel's cascade, kept", () => {
    const seg = {
      ...newSegment(),
      text: 'Vi går til kjøkkenet.',
      focus: [{ id: 'f1', wordIndex: 3, why: 'kj' }],
    };
    const next = setSegmentText(doc({ segments: [seg] }), seg.id, 'Vi går alle til kjøkkenet.');
    expect(next.segments[0]?.focus).toEqual([{ id: 'f1', wordIndex: 4, why: 'kj' }]);
    const gone = setSegmentText(next, seg.id, 'Vi går alle til stua.');
    expect(gone.orphans).toMatchObject([{ id: 'f1', surface: 'kjøkkenet', why: 'kj' }]);
  });
});

describe('applySplit (AC-B2)', () => {
  it("splits by the pack of the document's language and names the estimated segments", () => {
    const ex = withAudioDraft(doc(), {
      ...audioDraftOf(doc()),
      audio: { ...doc().audio, duration: 20 },
    });
    const { ex: split, estimated } = applySplit(ex, 'Jeg bor i Oslo. Hun bor i Bergen!');
    expect(split.segments.map((s) => s.text)).toEqual(['Jeg bor i Oslo.', 'Hun bor i Bergen!']);
    expect(estimated).toEqual(split.segments.map((s) => s.id));
    expect(split.segments.every((s) => s.audio !== null && s.audio.end > s.audio.start)).toBe(true);
    expect(split.updatedAt).toBe(ex.updatedAt);
  });

  it('leaves the document alone for a text with no sentence in it', () => {
    const ex = doc();
    expect(applySplit(ex, '   ')).toEqual({ ex, estimated: [] });
  });
});

describe('setMode', () => {
  it('joins into one text without losing a focus word, and keeps the token', () => {
    const a = {
      ...newSegment(),
      text: 'Vi går.',
      focus: [] as DictationContent['segments'][0]['focus'],
    };
    const b = {
      ...newSegment(),
      text: 'Det regner nå.',
      focus: [{ id: 'f1', wordIndex: 2, why: 'å' }],
    };
    const whole = setMode(doc({ segments: [a, b] }), 'whole');
    expect(whole.segments).toHaveLength(1);
    expect(whole.segments[0]).toMatchObject({ text: 'Vi går. Det regner nå.' });
    expect(whole.segments[0]?.focus).toEqual([{ id: 'f1', wordIndex: 4, why: 'å' }]);
    expect(whole.audio.useSegments).toBe(false);
    expect(whole.updatedAt).toBe('2026-10-04T10:00:00.000Z');
  });
});
