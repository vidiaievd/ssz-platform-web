// Editing operations on a `match_pairs` document, for the builder.
//
// Everything here is pure: document in, document out. The derived side of the model —
// the right-hand pool, coverage, what is wrong with the document — belongs to
// `@/lib/shared-kernel/match-pairs` and is never recomputed here. This file only
// rewrites what the teacher typed, and hands the consequences of a deletion to the
// kernel's `pruneFeedback`, so that the builder and the server's save-time cleanup
// cannot disagree about what a delete takes with it.

import {
  EMPTY_FEEDBACK,
  norm,
  pruneFeedback,
  wrongItems,
  type MatchPairs,
  type Pair,
  type PairFeedback,
  type PairId,
  type RightId,
  type Settings,
  type Variant,
} from '@/lib/shared-kernel/match-pairs';

/**
 * A pair id. Only has to be unique within one exercise and stable across the edit
 * session: it keys the student's slot and the row of the feedback matrix.
 */
export function newPairId(): PairId {
  return `p${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * An id for one item of the right-hand pool — a pair's own half or a distractor.
 *
 * **One generator for both**, and no prefix that says which is which: in the pool the
 * two have to be indistinguishable, or the payload the student receives is a partial
 * answer key (plan 49, decision 2 — AC-S15). The `h` is a namespace marker against pair
 * ids, not a kind marker: slots are keyed by `Pair.id`, pool items by `RightId`, and the
 * two sets never share a value.
 */
export function newRightId(): RightId {
  return `h${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyPair(): Pair {
  return { id: newPairId(), rightId: newRightId(), left: '', right: '' };
}

/** Which half of the pair a field writes to. `right` is the answer. */
export type Half = 'left' | 'right';

export function setPairHalf(ex: MatchPairs, pairId: PairId, half: Half, text: string): MatchPairs {
  return {
    ...ex,
    pairs: ex.pairs.map((pair) => (pair.id === pairId ? { ...pair, [half]: text } : pair)),
  };
}

/**
 * "Why this is the right half" — written on the pair card in step 1, stored with the
 * pair's explanations because that is what it is: text shown to the student, on reveal
 * rather than on a wrong answer (BEHAVIOR §1.4).
 */
export function setWhy(ex: MatchPairs, pairId: PairId, why: string): MatchPairs {
  const current: PairFeedback = ex.feedback[pairId] ?? EMPTY_FEEDBACK;
  return {
    ...ex,
    feedback: { ...ex.feedback, [pairId]: { ...current, ov: { ...current.ov }, why } },
  };
}

export function whyOf(ex: MatchPairs, pairId: PairId): string {
  return ex.feedback[pairId]?.why ?? '';
}

/**
 * The variant, chosen explicitly rather than defaulted into.
 *
 * It decides whether a missing default explanation refuses publication (`halves`) or only
 * warns (`pairs`), which is why the builder makes the teacher say which one this is —
 * see `hasExplicitVariant`.
 */
export function setVariant(ex: MatchPairs, variant: Variant): MatchPairs {
  return { ...ex, variant };
}

/**
 * Whether the stored content actually named a variant, as opposed to being read as
 * `pairs` because the field was absent.
 *
 * The kernel cannot answer this: `readContent` resolves an absent field to `pairs`, and
 * by the time a document exists the two cases look identical. Asked of the raw content
 * column, before it is parsed — the one place the difference is still visible.
 */
export function hasExplicitVariant(content: unknown): boolean {
  if (typeof content !== 'object' || content === null) return false;
  const variant = (content as Record<string, unknown>)['variant'];
  return variant === 'halves' || variant === 'pairs';
}

export function addPair(ex: MatchPairs, pair: Pair): MatchPairs {
  return { ...ex, pairs: [...ex.pairs, pair] };
}

/**
 * Delete a pair, and with it every explanation that no longer addresses anything: its own
 * row, and every override in the other pairs that pointed at its half, which has just
 * left the pool (AC-B4). The cascade is the kernel's, so it is the same one the server
 * runs on save.
 */
export function removePair(ex: MatchPairs, pairId: PairId): MatchPairs {
  return pruneFeedback({ ...ex, pairs: ex.pairs.filter((pair) => pair.id !== pairId) });
}

/**
 * The list after a drag. Ids are untouched — numbering is positional everywhere (the
 * pool chips, the matrix rows), so nothing is stored that could fall out of step
 * (AC-B3).
 */
export function reorderPairs(ex: MatchPairs, pairs: Pair[]): MatchPairs {
  return { ...ex, pairs };
}

/** A pair the teacher has not started: not an error, and not something to keep. */
function isBlank(pair: Pair): boolean {
  return pair.left.trim() === '' && pair.right.trim() === '';
}

// ── Paste a list ────────────────────────────────────────────────────────────

/** `|`, a tab, or a spaced em dash — whichever the teacher's source happened to use. */
const SEPARATOR = /\s*(?:\||\t|\s—\s)\s*/;

export interface ParsedLine {
  left: string;
  /** Empty when the line carried no separator — flagged in the modal's preview (AC-B6). */
  right: string;
}

/**
 * One sentence per line, split at the first separator. Id-free on purpose: the modal
 * re-parses on every keystroke to show its preview, and minting ids there would hand a
 * new identity to a row the teacher is still typing.
 */
export function parsePasteLines(raw: string): ParsedLine[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [left = '', right = ''] = line.split(SEPARATOR);
      return { left: left.trim(), right: right.trim() };
    });
}

export function pairsFromPaste(raw: string): Pair[] {
  return parsePasteLines(raw).map((line) => ({
    ...emptyPair(),
    left: line.left,
    right: line.right,
  }));
}

/**
 * Append the pasted rows, dropping the blank cards that were already in the list (AC-B7).
 *
 * A teacher who opens a new exercise and pastes into it should not be left with the
 * empty first card sitting above their work — but a *half*-written pair is somebody's
 * unfinished sentence and stays, error and all.
 */
export function applyPaste(ex: MatchPairs, raw: string): MatchPairs {
  const added = pairsFromPaste(raw);
  if (added.length === 0) return ex;

  return pruneFeedback({ ...ex, pairs: [...ex.pairs.filter((pair) => !isBlank(pair)), ...added] });
}

// ── Step 2 — the right column ───────────────────────────────────────────────

/**
 * Why a typed half cannot join the pool: it reads the same as a correct half (grading
 * would be a coin toss, so the spec refuses it at the input — AC-B11), or the same as an
 * extra already there. `null` means it can.
 *
 * The second case is not in the spec, but `POOL_DUPLICATE` is a blocker either way, and
 * catching it in the field beats catching it in the pre-assign gate.
 */
export function distractorProblem(ex: MatchPairs, text: string): 'answer' | 'duplicate' | null {
  const candidate = norm(text);
  if (candidate === '') return null;

  if (ex.pairs.some((pair) => norm(pair.right) === candidate)) return 'answer';
  if (ex.distractors.some((distractor) => norm(distractor.text) === candidate)) return 'duplicate';
  return null;
}

/** Add one extra half. The caller has already reported the reasons it might be refused. */
export function addDistractor(ex: MatchPairs, text: string): MatchPairs {
  const trimmed = text.trim();
  if (trimmed === '' || distractorProblem(ex, trimmed) !== null) return ex;

  return { ...ex, distractors: [...ex.distractors, { id: newRightId(), text: trimmed }] };
}

/**
 * Drop an extra half, and with it every override written against it: its column leaves
 * the matrix and the coverage total shrinks (AC-B12).
 *
 * Note what this is *not*: switching `settings.distractors` off. That hides the extras
 * from the pool and from the matrix and deletes nothing (AC-B14), which is why the toggle
 * is safe to flip while authoring and this button asks for a deliberate click.
 */
export function removeDistractor(ex: MatchPairs, id: RightId): MatchPairs {
  return pruneFeedback({
    ...ex,
    distractors: ex.distractors.filter((distractor) => distractor.id !== id),
  });
}

export function setSettings(ex: MatchPairs, patch: Partial<Settings>): MatchPairs {
  return { ...ex, settings: { ...ex.settings, ...patch } };
}

// ── Step 3 — the explanations ───────────────────────────────────────────────

function withFeedback(
  ex: MatchPairs,
  pairId: PairId,
  update: (current: PairFeedback) => PairFeedback,
): MatchPairs {
  const current = ex.feedback[pairId] ?? EMPTY_FEEDBACK;
  return {
    ...ex,
    feedback: { ...ex.feedback, [pairId]: update({ ...current, ov: { ...current.ov } }) },
  };
}

/**
 * The explanation any wrong half gets when nothing more specific was written. Required to
 * publish a `halves` set, and the thing most students will actually read.
 */
export function setDefault(ex: MatchPairs, pairId: PairId, def: string): MatchPairs {
  return withFeedback(ex, pairId, (current) => ({ ...current, def }));
}

/**
 * Why attaching exactly this half to this left half is wrong.
 *
 * Blank text removes the cell rather than storing an empty one: an empty cell means "use
 * the pair's default", and a stored blank would count as written towards coverage while
 * showing the student nothing. Writing over an AI draft makes the text the teacher's own
 * — accepting a draft is editing it.
 */
export function setOverride(
  ex: MatchPairs,
  pairId: PairId,
  rightId: RightId,
  text: string,
): MatchPairs {
  return withFeedback(ex, pairId, (current) => {
    const ov = { ...current.ov };
    if (text.trim() === '') delete ov[rightId];
    else ov[rightId] = { text, origin: 'author' };
    return { ...current, ov };
  });
}

/** Authored override text for one cell — an unaccepted AI draft is not text yet. */
export function overrideText(ex: MatchPairs, pairId: PairId, rightId: RightId): string {
  const override = ex.feedback[pairId]?.ov[rightId];
  return override?.origin === 'author' ? override.text : '';
}

export interface PairCoverage {
  /** Pool halves other than this pair's own — the whole row of the matrix. */
  total: number;
  /** Of those, the ones with authored text. */
  written: number;
}

/** One pair's share of the coverage meter (AC-B16). Empty cells are legitimate by design. */
export function pairCoverage(ex: MatchPairs, pairId: PairId): PairCoverage {
  const cells = wrongItems(ex, pairId);
  return {
    total: cells.length,
    written: cells.filter((item) => overrideText(ex, pairId, item.id).trim() !== '').length,
  };
}
