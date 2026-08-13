// Editing operations on an `error_correction` document, for the builder.
//
// Everything here is pure: document in, document out. The derived side of the model —
// what the mistakes are, what type each one is, whether the document is ready — belongs
// to `@/lib/shared-kernel/error-correction` and is never duplicated here. This file only
// rewrites what the author typed.
//
// Nothing prunes `meta`. An override is keyed by the span it explains, so editing a
// sentence already makes a stale override inert (see the kernel's `spanKey`); dropping
// it as well would mean an author who fixes a typo in `wrong` silently loses the
// explanation they wrote for a mistake that is still there.

import type {
  ErrorCorrection,
  Item,
  SpanKey,
  SpanOverride,
} from '@/lib/shared-kernel/error-correction';

/** Only has to be unique within one exercise and stable across the edit session. */
export function newItemId(): string {
  return `i${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyItem(): Item {
  return { id: newItemId(), wrong: '', ref: '', alts: [], meta: {} };
}

/** What an author may type straight into one item. `meta` is not among them — see below. */
export type ItemPatch = Partial<Pick<Item, 'wrong' | 'ref' | 'alts' | 'hint' | 'teacherNote'>>;

export function setItem(
  exercise: ErrorCorrection,
  itemId: string,
  patch: ItemPatch,
): ErrorCorrection {
  return {
    ...exercise,
    items: exercise.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  };
}

/**
 * One override on one derived span.
 *
 * Separate from `setItem` because the key is not the author's to choose: it comes from
 * the span the kernel derived, and writing it by hand is how an override ends up
 * attached to a mistake that does not exist.
 */
export function setSpanOverride(
  exercise: ErrorCorrection,
  itemId: string,
  key: SpanKey,
  patch: SpanOverride,
): ErrorCorrection {
  return {
    ...exercise,
    items: exercise.items.map((item) =>
      item.id === itemId
        ? { ...item, meta: { ...item.meta, [key]: { ...item.meta[key], ...patch } } }
        : item,
    ),
  };
}

export function addItem(exercise: ErrorCorrection, item: Item): ErrorCorrection {
  return { ...exercise, items: [...exercise.items, item] };
}

/**
 * A copy, right after the original, with the overrides carried over.
 *
 * The overrides survive because the copy starts out with the same two sentences, so the
 * derived spans — and therefore the keys — are the same. They stop applying as soon as
 * the author changes either sentence, which is the same rule as everywhere else here.
 */
export function duplicateItem(exercise: ErrorCorrection, itemId: string): ErrorCorrection {
  const index = exercise.items.findIndex((item) => item.id === itemId);
  if (index === -1) return exercise;
  const original = exercise.items[index]!;
  const copy: Item = {
    ...original,
    id: newItemId(),
    alts: [...original.alts],
    meta: { ...original.meta },
  };
  return {
    ...exercise,
    items: [...exercise.items.slice(0, index + 1), copy, ...exercise.items.slice(index + 1)],
  };
}

export function removeItem(exercise: ErrorCorrection, itemId: string): ErrorCorrection {
  return { ...exercise, items: exercise.items.filter((item) => item.id !== itemId) };
}

/**
 * The alternatives textarea: one accepted sentence per line.
 *
 * Blank lines are dropped rather than stored, so that a trailing newline does not become
 * an empty variant the kernel then has to ignore — but they are dropped on the way in
 * only, which leaves the author free to press Enter and keep typing.
 */
export function parseAlts(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
