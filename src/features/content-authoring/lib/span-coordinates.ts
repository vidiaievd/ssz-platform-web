import { err, ok, type Result } from '@/lib/result';

import { splitParagraphsWithOffsets } from './split-paragraphs';

/**
 * Longest selection the service will accept as a span (`SPAN_TOO_LONG`,
 * spec 16 §3.2). Kept here as well so the editor can say why a selection was
 * refused without a round trip; it must not drift from the service's cap.
 */
export const MAX_SPAN_LENGTH = 400;

/** The anchor a span is created with — offsets into one paragraph's raw markdown. */
export interface SpanCoordinates {
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
}

export type SpanSelectionError =
  /** Nothing but whitespace was selected — there is nothing to annotate. */
  | 'empty'
  /** The selection runs across a blank line; a span belongs to exactly one paragraph. */
  | 'crosses-paragraph'
  /** Longer than the service accepts. */
  | 'too-long';

/**
 * Converts a textarea selection over the lesson body into span coordinates.
 *
 * The editor edits raw markdown, so `selStart`/`selEnd` are already in the
 * coordinate space spans are stored in — but relative to the *whole body*,
 * while a span is relative to one *trimmed* paragraph. This is the only place
 * that conversion happens.
 *
 * Whitespace at the edges of the selection is dropped first. Authors drag
 * sloppily and pick up a trailing space, and the service refuses a snapshot
 * that is empty or whitespace-only; silently tightening the selection is both
 * what the author meant and what keeps the round trip from failing. It also
 * makes the paragraph lookup exact: after trimming, both endpoints sit on
 * non-whitespace, which is always inside some paragraph.
 *
 * Selections spanning a paragraph boundary are rejected rather than clamped.
 * Clamping would annotate something the author did not select, and spec 16 §2.3
 * requires the authoring UI not to create spans the renderer would have to drop.
 */
export function bodyRangeToSpan(
  body: string,
  selStart: number,
  selEnd: number,
): Result<SpanCoordinates, SpanSelectionError> {
  const rawStart = Math.max(0, Math.min(selStart, selEnd));
  const rawEnd = Math.min(body.length, Math.max(selStart, selEnd));
  const raw = body.slice(rawStart, rawEnd);

  const start = rawStart + (raw.length - raw.trimStart().length);
  const end = rawEnd - (raw.length - raw.trimEnd().length);
  if (start >= end) return err('empty');

  if (end - start > MAX_SPAN_LENGTH) return err('too-long');

  const paragraphs = splitParagraphsWithOffsets(body);
  const paragraph = paragraphs.find((p) => p.bodyStart <= start && start < p.bodyEnd);
  // Both endpoints are non-whitespace, so each is inside some paragraph; a
  // missing or different one means the selection reaches into the next.
  if (!paragraph || end > paragraph.bodyEnd) return err('crosses-paragraph');

  return ok({
    paragraphIndex: paragraph.index,
    charStart: start - paragraph.bodyStart,
    charEnd: end - paragraph.bodyStart,
  });
}

/**
 * The inverse: where a stored span sits in the current body, for highlighting
 * it in the editor and for scrolling to a re-anchor candidate.
 *
 * Returns `null` when the anchor no longer fits this body — the same condition
 * the service reports as `broken` with `brokenReason: 'offset'`. Callers must
 * treat `null` as "cannot be shown in the text", not as an error: a broken span
 * is still listed, and still repairable, in the authoring panel.
 */
export function spanToBodyRange(
  body: string,
  span: SpanCoordinates,
): { start: number; end: number } | null {
  const paragraph = splitParagraphsWithOffsets(body)[span.paragraphIndex];
  if (!paragraph) return null;
  if (span.charStart < 0 || span.charEnd > paragraph.text.length) return null;
  if (span.charStart >= span.charEnd) return null;

  return {
    start: paragraph.bodyStart + span.charStart,
    end: paragraph.bodyStart + span.charEnd,
  };
}
