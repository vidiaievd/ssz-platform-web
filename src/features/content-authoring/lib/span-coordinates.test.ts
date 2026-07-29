import { describe, expect, it } from 'vitest';

import {
  bodyRangeToSpan,
  spanToBodyRange,
  MAX_SPAN_LENGTH,
  type SpanCoordinates,
  type SpanSelectionError,
} from './span-coordinates';
import { splitParagraphs } from './split-paragraphs';
import type { Result } from '@/lib/result';

function expectOk(result: Result<SpanCoordinates, SpanSelectionError>): SpanCoordinates {
  if (!result.ok) throw new Error(`expected coordinates, got "${result.error}"`);
  return result.value;
}

/**
 * The property every case below is really testing: the coordinates handed to
 * the service must slice the *paragraph the service will build* back to the
 * text the author selected. That is exactly the comparison the service makes
 * when it derives `text_snapshot`, so anything failing here would be rejected
 * upstream — or worse, accepted against the wrong paragraph.
 */
function sliceViaSpan(body: string, span: { paragraphIndex: number; charStart: number; charEnd: number }) {
  return splitParagraphs(body)[span.paragraphIndex]?.slice(span.charStart, span.charEnd);
}

describe('bodyRangeToSpan', () => {
  it('maps a selection in the first paragraph', () => {
    const body = 'Hun er sykepleier.\n\nHun jobber om natten.';
    const result = bodyRangeToSpan(body, 7, 17);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 0, charStart: 7, charEnd: 17 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('sykepleier');
  });

  it('rebases offsets against the paragraph, not the body', () => {
    const body = 'Hun er sykepleier.\n\nHun jobber om natten.';
    const start = body.indexOf('natten');
    const result = bodyRangeToSpan(body, start, start + 6);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 1, charStart: 14, charEnd: 20 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('natten');
  });

  it("subtracts the paragraph's trimmed leading whitespace", () => {
    // The service trims each paragraph, so its offset 0 is the 'S' of "Second",
    // not the two spaces before it.
    const body = 'First.\n\n   Second paragraph.';
    const start = body.indexOf('paragraph');
    const result = bodyRangeToSpan(body, start, start + 9);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 1, charStart: 7, charEnd: 16 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('paragraph');
  });

  it('numbers paragraphs after the service has dropped the empty ones', () => {
    // A leading blank line makes String.split emit an empty first chunk, which
    // the service filters out — so "Real" is paragraph 0, not paragraph 1.
    const body = '\n\nReal first.\n\nReal second.';
    const start = body.indexOf('second');
    const result = bodyRangeToSpan(body, start, start + 6);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 1, charStart: 5, charEnd: 11 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('second');
  });

  it('collapses a run of blank lines into one boundary', () => {
    const body = 'A first line.\n\n   \n\nB second line.';
    const start = body.indexOf('second');
    const result = bodyRangeToSpan(body, start, start + 6);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 1, charStart: 2, charEnd: 8 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('second');
  });

  it('keeps working inside a soft-wrapped paragraph', () => {
    // A single newline is not a paragraph break; offsets must count it.
    const body = 'Første linje\nandre linje.\n\nNeste avsnitt.';
    const start = body.indexOf('andre');
    const result = bodyRangeToSpan(body, start, start + 5);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 0, charStart: 13, charEnd: 18 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('andre');
  });

  it('counts markdown delimiters, since offsets are into the raw source', () => {
    const body = 'Hun er **sykepleier** her.';
    const start = body.indexOf('sykepleier');
    const result = bodyRangeToSpan(body, start, start + 10);

    expect(result).toEqual({
      ok: true,
      value: { paragraphIndex: 0, charStart: 9, charEnd: 19 },
    });
    expect(sliceViaSpan(body, expectOk(result))).toBe('sykepleier');
  });

  it('trims whitespace the author dragged in at the edges', () => {
    const body = 'Hun er sykepleier her.';
    const loose = bodyRangeToSpan(body, 6, 18);
    const tight = bodyRangeToSpan(body, 7, 17);

    expect(loose).toEqual(tight);
    expect(sliceViaSpan(body, expectOk(loose))).toBe('sykepleier');
  });

  it('rejects a whitespace-only selection', () => {
    expect(bodyRangeToSpan('Hun er sykepleier.', 6, 7)).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects a collapsed caret', () => {
    expect(bodyRangeToSpan('Hun er sykepleier.', 7, 7)).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects a selection crossing a paragraph boundary', () => {
    const body = 'Første avsnitt.\n\nAndre avsnitt.';
    expect(bodyRangeToSpan(body, 7, body.indexOf('Andre') + 5)).toEqual({
      ok: false,
      error: 'crosses-paragraph',
    });
  });

  it('accepts a selection that over-drags into the blank line after a paragraph', () => {
    // Trimming pulls the end back inside paragraph 0, so this is a valid span,
    // not a crossing — the author simply over-dragged.
    const body = 'Første avsnitt.\n\nAndre avsnitt.';
    expect(bodyRangeToSpan(body, 7, 17)).toEqual({
      ok: true,
      value: { paragraphIndex: 0, charStart: 7, charEnd: 15 },
    });
  });

  it('rejects a selection longer than the service accepts', () => {
    const body = 'a'.repeat(MAX_SPAN_LENGTH + 1);
    expect(bodyRangeToSpan(body, 0, body.length)).toEqual({ ok: false, error: 'too-long' });
    expect(bodyRangeToSpan(body, 0, MAX_SPAN_LENGTH).ok).toBe(true);
  });

  it('clamps a selection running past the end of the body', () => {
    const body = 'Hun er sykepleier.';
    expect(bodyRangeToSpan(body, 7, 9999)).toEqual({
      ok: true,
      value: { paragraphIndex: 0, charStart: 7, charEnd: 18 },
    });
  });

  it('normalises a backwards selection', () => {
    const body = 'Hun er sykepleier.';
    expect(bodyRangeToSpan(body, 17, 7)).toEqual(bodyRangeToSpan(body, 7, 17));
  });

  it('returns empty for a blank body', () => {
    expect(bodyRangeToSpan('   \n  ', 0, 6)).toEqual({ ok: false, error: 'empty' });
  });
});

describe('spanToBodyRange', () => {
  it('round-trips every selection back to the same body offsets', () => {
    const body = '\n\n  Første avsnitt her.\n\n\nAndre **avsnitt** her.\nsoft wrap.';
    let checked = 0;

    for (let start = 0; start < body.length; start++) {
      for (let end = start + 1; end <= body.length; end++) {
        const span = bodyRangeToSpan(body, start, end);
        if (!span.ok) continue;
        checked++;

        const range = spanToBodyRange(body, span.value);
        expect(range).not.toBeNull();
        // The round trip lands on the trimmed selection, which is what the
        // service stored — not necessarily on the author's sloppy drag.
        expect(body.slice(range!.start, range!.end)).toBe(
          sliceViaSpan(body, span.value),
        );
      }
    }

    // Guards the loop against degenerating: if bodyRangeToSpan started
    // rejecting everything, every assertion above would silently be skipped.
    expect(checked).toBeGreaterThan(500);
  });

  it('locates a span in a later paragraph', () => {
    const body = 'First.\n\n   Second paragraph.';
    expect(spanToBodyRange(body, { paragraphIndex: 1, charStart: 7, charEnd: 16 })).toEqual({
      start: 18,
      end: 27,
    });
    expect(body.slice(18, 27)).toBe('paragraph');
  });

  it('returns null when the paragraph no longer exists', () => {
    expect(spanToBodyRange('Only one.', { paragraphIndex: 3, charStart: 0, charEnd: 4 })).toBeNull();
  });

  it('returns null when the range runs past the end of the paragraph', () => {
    expect(spanToBodyRange('Short.', { paragraphIndex: 0, charStart: 0, charEnd: 99 })).toBeNull();
  });

  it('returns null for an inverted or empty range', () => {
    expect(spanToBodyRange('Short.', { paragraphIndex: 0, charStart: 3, charEnd: 3 })).toBeNull();
    expect(spanToBodyRange('Short.', { paragraphIndex: 0, charStart: 4, charEnd: 2 })).toBeNull();
  });

  it('returns null after an edit shifted the paragraph under the span', () => {
    // The canonical rot scenario: a character inserted before the span. The
    // offsets still resolve, so only the snapshot comparison upstream can catch
    // it — but a paragraph deleted outright is caught right here.
    const before = 'Hun er sykepleier.\n\nAndre avsnitt.';
    const span = bodyRangeToSpan(before, 7, 17);
    expect(span.ok).toBe(true);

    const afterParagraphDeleted = 'Hun er sykepleier.';
    expect(
      spanToBodyRange(afterParagraphDeleted, { paragraphIndex: 1, charStart: 0, charEnd: 5 }),
    ).toBeNull();
  });
});
