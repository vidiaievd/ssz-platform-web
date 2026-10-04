'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import {
  clampToParagraph,
  paragraphOfTokens,
  tokenize,
  type Unit,
} from '@/lib/shared-kernel/highlight-in-text';
import { splitParagraphsWithOffsets } from '@/lib/shared-kernel/text';

/**
 * How one token is drawn (plan 67 §7.1).
 *
 * `key` — the author's mark, or the key on reveal; `sel` — the student's mark before a check;
 * `ok` / `fp` / `near` — the student's mark after one; `miss` — key words the student did
 * not cover.
 */
export type MarkState = 'key' | 'sel' | 'ok' | 'fp' | 'near' | 'miss';

export interface MarkCell {
  m: MarkState;
  /**
   * The run the token belongs to. Neighbouring tokens with the same `k` are one run: the
   * punctuation between them is tinted with it and the corners round only at its ends.
   */
  k: string;
  /**
   * The token lies inside a key span a `near` mark overlapped — underlined, so the answer's
   * real boundary is drawn and colour is not the only carrier (BEHAVIOR §8).
   */
  keyLine?: boolean;
}

export interface MarkableTextProps {
  text: string;
  /** The cell of token `i`, or `null` for plain text. Absent — nothing is marked. */
  cellOf?: (i: number) => MarkCell | null;
  /** `word` marks the token pressed; `phrase` also lets a drag widen it. */
  unit?: Unit;
  /** Tokens are buttons. Off — the passage is read, not marked. */
  live?: boolean;
  /**
   * A press, drag or key toggled a range. `origin` is where it started and may be either
   * end — what a `word` question keeps and where a paragraph cut is measured from.
   */
  onRange?: (origin: number, end: number) => void;
  /** Shift+→ / Shift+← on a marked token of a `phrase` question. */
  onExtend?: (i: number, delta: 1 | -1) => void;
  /** The run outlined as linked to a row outside the text (AC-A7). */
  hot?: string | null;
  /** The pointer entered a run (`k`) or left it (`null`) — the other half of AC-A7. */
  onHover?: (k: string | null) => void;
  /** The superscript ordinal drawn on the first token of a run, if any. */
  numbers?: (i: number) => number | null;
  /** The element naming what is being marked — the question's prompt (BEHAVIOR §8). */
  labelledBy?: string;
  /** A name for the passage when there is no element to point at. */
  label?: string;
  /** The text may be selected and copied — the read-only render in step 1. */
  selectable?: boolean;
}

const READING_STYLE = {
  fontFamily: 'var(--ssz-font-reading)',
  fontSize: 'var(--ssz-text-lg)',
  lineHeight: 2.15,
  color: 'var(--ssz-text-primary)',
  textWrap: 'pretty',
} as const;

/** Background and ink per state — `ht.css`, value for value, from tokens only (AC-X5). */
const STATE = [
  'data-[m=key]:bg-(--ssz-color-primary-100) data-[m=key]:text-(--ssz-color-primary-800) data-[m=key]:font-semibold',
  'data-[m=sel]:bg-(--ssz-color-warning-100) data-[m=sel]:text-(--ssz-color-warning-700) data-[m=sel]:font-semibold',
  'data-[m=ok]:bg-(--ssz-color-success-100) data-[m=ok]:text-(--ssz-color-success-700) data-[m=ok]:font-semibold',
  'data-[m=fp]:bg-(--ssz-color-error-50) data-[m=fp]:text-(--ssz-color-error-700) data-[m=fp]:line-through data-[m=fp]:decoration-1',
  'data-[m=near]:bg-(--ssz-color-warning-50) data-[m=near]:text-(--ssz-color-warning-700)',
  'data-[m=miss]:bg-transparent data-[m=miss]:text-(--ssz-color-primary-700) data-[m=miss]:shadow-[inset_0_-2px_0_0_var(--ssz-color-primary-400)]',
  'data-keyline:shadow-[inset_0_-2px_0_0_var(--ssz-color-primary-400)]',
].join(' ');

/** The text does not move; only the tint does (BEHAVIOR §9). Reduced motion is global. */
const MOTION =
  'transition-[background-color,box-shadow] duration-(--ssz-duration-fast) ease-(--ssz-ease-out)';

const EDGE =
  'data-start:rounded-l-[7px] data-start:pl-1 data-start:-ml-0.5 data-end:rounded-r-[7px] data-end:pr-1 data-end:-mr-0.5';

const HOT =
  'data-hot:rounded-[5px] data-hot:shadow-[inset_0_0_0_1.5px_var(--ssz-color-primary-400)]';

const LIVE =
  'cursor-pointer [&:not([data-m]):hover]:bg-(--ssz-bg-muted) [&[data-m]:hover]:brightness-[.97] focus-visible:rounded-[5px]';

const TOKEN = `inline-block py-[3px] ${STATE} ${EDGE} ${HOT} ${MOTION}`;
const SEPARATOR = `py-[3px] ${STATE} ${MOTION}`;

/**
 * The passage of a `highlight_in_text` exercise, token by token — **the one renderer** of
 * this type (CLAUDE.md of the handoff, rule 4; AC-X10). The builder's marking canvas, the
 * read-only render in step 1, the preview and the student's runner all draw through it, and
 * none of them draws the passage any other way.
 *
 * It knows nothing about keys, verdicts or questions: every token's look comes from
 * `cellOf`, and every gesture goes out through `onRange` / `onExtend` as token indices. The
 * caller decides what a toggle means — the builder edits the author's spans, the runner the
 * student's marks.
 *
 * Tokens and paragraphs come from the kernel, the same build the grader runs (rule 5), so a
 * word drawn here is the word the server will judge.
 *
 * **Gestures.** A press marks; with `unit: 'phrase'` a drag across tokens widens the mark
 * until release. A drag never leaves the paragraph it started in (plan 67 §4.2 p. 8). The
 * release is listened for on the window from the press itself, not from an effect, so a
 * click faster than a render is never lost (the prototype's lesson). On touch the implicit
 * pointer capture is released at the press, so the tokens under the finger receive the
 * drag; `touch-action: pan-y` on a phrase passage keeps vertical scrolling and leaves
 * sideways drags to marking. Keyboard: tokens are in the tab order, Enter or Space toggles,
 * Shift+→ / Shift+← grows or shrinks a phrase mark (AC-X7).
 */
export function MarkableText({
  text,
  cellOf,
  unit = 'word',
  live = false,
  onRange,
  onExtend,
  hot = null,
  onHover,
  numbers,
  labelledBy,
  label,
  selectable = false,
}: MarkableTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const paragraphOf = useMemo(() => paragraphOfTokens(text, tokens), [text, tokens]);
  const paragraphs = useMemo(() => splitParagraphsWithOffsets(text), [text]);

  const drag = useRef<{ origin: number; cursor: number } | null>(null);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  /** Ends a drag in progress: commits it on release, drops it on cancel or unmount. */
  const stop = useRef<((commit: boolean) => void) | null>(null);
  const latest = useRef(onRange);
  useEffect(() => {
    latest.current = onRange;
  });
  useEffect(() => () => stop.current?.(false), []);

  const cell = (i: number): MarkCell | null => {
    if (dragRange !== null && i >= dragRange[0] && i <= dragRange[1])
      return { m: 'sel', k: 'drag' };
    return cellOf?.(i) ?? null;
  };

  function press(i: number, event: PointerEvent<HTMLSpanElement>) {
    if (!live || event.button !== 0) return;
    // No text selection and no focus jump on a mouse press: the press is the gesture.
    event.preventDefault();
    const target = event.currentTarget;
    if (
      typeof target.hasPointerCapture === 'function' &&
      target.hasPointerCapture(event.pointerId)
    ) {
      target.releasePointerCapture(event.pointerId);
    }

    stop.current?.(false);
    drag.current = { origin: i, cursor: i };
    setDragRange([i, i]);

    const up = () => finish(true);
    const cancel = () => finish(false);
    function finish(commit: boolean) {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      stop.current = null;
      const done = drag.current;
      drag.current = null;
      setDragRange(null);
      if (commit && done !== null) latest.current?.(done.origin, done.cursor);
    }
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    stop.current = finish;
  }

  function enter(i: number) {
    onHover?.(cellOf?.(i)?.k ?? null);
    const current = drag.current;
    if (current === null || unit !== 'phrase') return;
    const run = clampToParagraph(paragraphOf, current.origin, i);
    current.cursor = i < current.origin ? run.t0 : run.t1;
    setDragRange([run.t0, run.t1]);
  }

  function key(i: number, event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRange?.(i, i);
      return;
    }
    if (
      event.shiftKey &&
      unit === 'phrase' &&
      onExtend !== undefined &&
      (event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
      cellOf?.(i) != null
    ) {
      event.preventDefault();
      onExtend(i, event.key === 'ArrowRight' ? 1 : -1);
    }
  }

  /** A click with no pointer behind it — assistive technology activating the button. */
  function activate(i: number, event: MouseEvent<HTMLSpanElement>) {
    if (event.detail === 0) onRange?.(i, i);
  }

  return (
    <div
      role="group"
      {...(labelledBy !== undefined ? { 'aria-labelledby': labelledBy } : {})}
      {...(labelledBy === undefined && label !== undefined ? { 'aria-label': label } : {})}
      data-markable-text=""
      style={{
        ...READING_STYLE,
        userSelect: selectable ? 'text' : 'none',
        WebkitUserSelect: selectable ? 'text' : 'none',
      }}
    >
      {paragraphs.map((paragraph, pi) => {
        const p0 = paragraph.bodyStart;
        const p1 = paragraph.bodyEnd;
        const nodes: ReactNode[] = [];
        let prev = p0;
        const inParagraph = (j: number) => paragraphOf[j] === pi;

        for (const t of tokens) {
          if (t.s < p0 || t.e > p1) continue;
          const c = cell(t.i);
          const before = t.i > 0 && inParagraph(t.i - 1) ? cell(t.i - 1) : null;
          const after = inParagraph(t.i + 1) ? cell(t.i + 1) : null;

          const gap = text.slice(prev, t.s);
          if (gap !== '') {
            // Punctuation inside a run is tinted with it; at its edge it is not (AC-M2).
            const joined = c !== null && before !== null && c.k === before.k;
            nodes.push(
              <span
                key={`s${t.i}`}
                className={joined ? SEPARATOR : undefined}
                data-m={joined ? c.m : undefined}
                data-keyline={
                  joined && c.keyLine === true && before.keyLine === true ? '' : undefined
                }
              >
                {gap}
              </span>,
            );
          }

          const starts = c !== null && (before === null || before.k !== c.k);
          const ends = c !== null && (after === null || after.k !== c.k);
          const n = starts && numbers !== undefined ? numbers(t.i) : null;

          nodes.push(
            <span
              key={`t${t.i}`}
              data-i={t.i}
              data-m={c?.m}
              data-start={starts ? '' : undefined}
              data-end={ends ? '' : undefined}
              data-hot={hot !== null && c !== null && c.k === hot ? '' : undefined}
              data-keyline={c?.keyLine === true ? '' : undefined}
              data-live={live ? undefined : 'false'}
              className={
                live ? `${TOKEN} ${LIVE}${unit === 'phrase' ? ' touch-pan-y' : ''}` : TOKEN
              }
              {...(live
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': c !== null,
                    onPointerDown: (event: PointerEvent<HTMLSpanElement>) => press(t.i, event),
                    onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => key(t.i, event),
                    onClick: (event: MouseEvent<HTMLSpanElement>) => activate(t.i, event),
                  }
                : {})}
              {...(live || onHover !== undefined
                ? {
                    onPointerEnter: () => enter(t.i),
                    ...(onHover !== undefined ? { onPointerLeave: () => onHover(null) } : {}),
                  }
                : {})}
            >
              {t.w}
              {n !== null && (
                <span
                  aria-hidden="true"
                  className="ml-px align-super font-bold opacity-75"
                  style={{ fontFamily: 'var(--ssz-font-mono)', fontSize: 9 }}
                >
                  {n}
                </span>
              )}
            </span>,
          );
          prev = t.e;
        }

        const tail = text.slice(prev, p1);
        if (tail !== '') nodes.push(<span key="tail">{tail}</span>);
        return (
          <p key={p0} className="m-0 mb-(--ssz-space-4) last:mb-0">
            {nodes}
          </p>
        );
      })}
    </div>
  );
}
