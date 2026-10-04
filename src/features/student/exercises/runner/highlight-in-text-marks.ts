import {
  clampToParagraph,
  toCharRange,
  toTokenRun,
  type CharRange,
  type Token,
  type TokenRun,
  type Unit,
} from '@/lib/shared-kernel/highlight-in-text';
import type {
  HighlightInTextCell,
  HighlightInTextSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import type { MarkCell } from './markable-text';

/**
 * The student's marks on one question — token runs, never overlapping, in text order.
 *
 * The same rules as the author's marks in the kernel's `toggleMark` / `resizeMark`, applied
 * to a list rather than to a document: the student has no spans with ids and explanations,
 * only runs. Kept here, beside the runner, so the kernel's editing functions stay about the
 * authored document.
 */
export type StudentMarks = readonly TokenRun[];

/**
 * A press, a drag or a key toggled `origin…end`.
 *
 * A single token on an existing mark removes that whole mark (AC-S2). Anything else becomes
 * one mark — the origin alone under `unit: 'word'` (AC-M3's rule, the runner's too), the run
 * cut at the origin's paragraph under `phrase` (AC-S3) — and replaces every mark it touches.
 */
export function toggleMark(
  marks: StudentMarks,
  origin: number,
  end: number,
  unit: Unit,
  paragraphOf: readonly number[],
): TokenRun[] {
  if (paragraphOf[origin] === undefined) return [...marks];
  const reach = unit === 'word' || paragraphOf[end] === undefined ? origin : end;
  const run = clampToParagraph(paragraphOf, origin, reach);

  if (run.t0 === run.t1) {
    const hit = marks.find((m) => m.t0 <= run.t0 && run.t0 <= m.t1);
    if (hit !== undefined) return marks.filter((m) => m !== hit);
  }

  const kept = marks.filter((m) => m.t1 < run.t0 || m.t0 > run.t1);
  return [...kept, run].sort((a, b) => a.t0 - b.t0);
}

/**
 * Shift+→ / Shift+← on token `i` — move the far end of the mark holding it by one token.
 * Never below one token, never past the paragraph, never into another mark.
 */
export function extendMark(
  marks: StudentMarks,
  i: number,
  delta: 1 | -1,
  paragraphOf: readonly number[],
): TokenRun[] {
  const mark = marks.find((m) => m.t0 <= i && i <= m.t1);
  if (mark === undefined) return [...marks];
  const t1 = mark.t1 + delta;
  if (t1 < mark.t0 || paragraphOf[t1] === undefined) return [...marks];
  if (paragraphOf[t1] !== paragraphOf[mark.t0]) return [...marks];
  if (marks.some((m) => m !== mark && m.t0 <= t1 && t1 <= m.t1)) return [...marks];
  return marks.map((m) => (m === mark ? { t0: mark.t0, t1 } : m));
}

/**
 * «Prøv på nytt» — keep exactly the marks the server called `exact`, clear the rest (AC-S6).
 *
 * Read off the verdict's cells rather than remembered: the cells are the marks as the server
 * snapped and merged them, and a mark is kept only when it is one of those, token for token.
 */
export function keepExact(
  marks: StudentMarks,
  cells: readonly HighlightInTextCell[],
  tokens: readonly Token[],
): TokenRun[] {
  const exact = cells
    .filter((c) => c.state === 'exact')
    .map((c) => toTokenRun(tokens, c))
    .filter((r): r is TokenRun => r !== null);
  return marks.filter((m) => exact.some((r) => r.t0 === m.t0 && r.t1 === m.t1));
}

/** The marks as the wire carries them — character offsets into the passage, `end` exclusive. */
export function toWire(marks: StudentMarks, tokens: readonly Token[]): CharRange[] {
  return marks.map((m) => toCharRange(tokens, m));
}

/** What the passage shows for one question: a cell per token, and the ordinals on reveal. */
export interface PassageCells {
  cells: Map<number, MarkCell>;
  numbers: Map<number, number>;
}

/**
 * The look of every token, from whichever state the question is in (BEHAVIOR §6).
 *
 * - **marking** — the student's own marks, `sel`;
 * - **checked** — the cells as the server returned them: `exact` → `ok`, `fp`, `near`. A
 *   `near` mark also draws the key span it overlapped: the key's tokens are underlined, and
 *   those the mark left out are drawn `miss` — the boundary is the lesson of that state,
 *   and it is the one key position a failed check may show (the server sends it for that);
 * - **revealed** — the whole key in `key`, each span numbered in text order.
 *
 * Nothing here knows the key beyond what the verdict carries.
 */
export function passageCells(
  marks: StudentMarks,
  verdict: HighlightInTextSubmitDetails | null,
  tokens: readonly Token[],
): PassageCells {
  const cells = new Map<number, MarkCell>();
  const numbers = new Map<number, number>();
  const paint = (run: TokenRun, cell: MarkCell) => {
    for (let i = run.t0; i <= run.t1; i++) cells.set(i, cell);
  };

  if (verdict !== null && verdict.revealed && verdict.key !== undefined) {
    for (const span of verdict.key) {
      const run = toTokenRun(tokens, span);
      if (run === null) continue;
      paint(run, { m: 'key', k: `key${span.n}` });
      numbers.set(run.t0, span.n);
    }
    return { cells, numbers };
  }

  if (verdict !== null) {
    verdict.cells.forEach((c, index) => {
      const run = toTokenRun(tokens, c);
      if (run === null) return;
      const k = `c${index}`;
      paint(run, { m: c.state === 'exact' ? 'ok' : c.state, k });
    });
    verdict.cells.forEach((c, index) => {
      if (c.state !== 'near' || c.keyStart === undefined || c.keyEnd === undefined) return;
      const key = toTokenRun(tokens, { start: c.keyStart, end: c.keyEnd });
      if (key === null) return;
      const k = `c${index}`;
      for (let i = key.t0; i <= key.t1; i++) {
        const here = cells.get(i);
        if (here === undefined) cells.set(i, { m: 'miss', k, keyLine: true });
        else if (here.k === k) cells.set(i, { ...here, keyLine: true });
      }
    });
    return { cells, numbers };
  }

  for (const m of marks) paint(m, { m: 'sel', k: `m${m.t0}` });
  return { cells, numbers };
}
