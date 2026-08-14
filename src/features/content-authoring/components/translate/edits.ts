// Editing operations on a `translate_*` document, for the builder.
//
// Everything here is pure: document in, document out. The derived side — how many
// variants a key expands into, what is wrong with the document, what a student's answer
// would score — belongs to `@/lib/shared-kernel/translate` and is never recomputed here.
// This file only rewrites what the author typed.

import type { Gloss, Guard, Item, Translate } from '@/lib/shared-kernel/translate';

/** Only has to be unique within one exercise and stable across the edit session. */
export function newItemId(): string {
  return `i${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * A new sentence starts with one empty key line rather than none.
 *
 * An item with no `refs` at all is a blocker (`ITEM_NO_REF`), and the card would have to
 * grow an "add the first accepted translation" button whose only purpose is to undo the
 * emptiness it was born with. The empty string is filtered out on save.
 */
export function emptyItem(dir: Item['dir']): Item {
  return { id: newItemId(), dir, source: '', refs: [''], gloss: [], require: [], forbid: [] };
}

/** What an author may type straight into one sentence. */
export type ItemPatch = Partial<
  Pick<
    Item,
    'dir' | 'source' | 'refs' | 'hint' | 'gloss' | 'explanation' | 'teacherNote' | 'mediaId'
  >
>;

export function setItem(exercise: Translate, itemId: string, patch: ItemPatch): Translate {
  return {
    ...exercise,
    items: exercise.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  };
}

export function addItem(exercise: Translate, item: Item): Translate {
  return { ...exercise, items: [...exercise.items, item] };
}

/** A copy right after the original, key and glosses included, under a new id. */
export function duplicateItem(exercise: Translate, itemId: string): Translate {
  const index = exercise.items.findIndex((item) => item.id === itemId);
  if (index === -1) return exercise;
  const original = exercise.items[index]!;
  const copy: Item = {
    ...original,
    id: newItemId(),
    refs: [...original.refs],
    gloss: original.gloss.map((entry) => ({ ...entry })),
    require: original.require.map((guard) => ({ ...guard })),
    forbid: original.forbid.map((guard) => ({ ...guard })),
  };
  return {
    ...exercise,
    items: [...exercise.items.slice(0, index + 1), copy, ...exercise.items.slice(index + 1)],
  };
}

export function removeItem(exercise: Translate, itemId: string): Translate {
  return { ...exercise, items: exercise.items.filter((item) => item.id !== itemId) };
}

/** One accepted translation, by position. `refs[0]` is the primary one. */
export function setRef(exercise: Translate, itemId: string, index: number, ref: string): Translate {
  return mapItem(exercise, itemId, (item) => ({
    ...item,
    refs: item.refs.map((current, at) => (at === index ? ref : current)),
  }));
}

export function addRef(exercise: Translate, itemId: string): Translate {
  return mapItem(exercise, itemId, (item) => ({ ...item, refs: [...item.refs, ''] }));
}

/**
 * Removing the last remaining key line leaves an empty one behind.
 *
 * The item would otherwise be left in the one state the card cannot edit its way out of —
 * a blocker with no field to fix it in.
 */
export function removeRef(exercise: Translate, itemId: string, index: number): Translate {
  return mapItem(exercise, itemId, (item) => {
    const refs = item.refs.filter((_, at) => at !== index);
    return { ...item, refs: refs.length === 0 ? [''] : refs };
  });
}

/** The glosses under a sentence: word and translation, in the order the author added them. */
export function setGloss(
  exercise: Translate,
  itemId: string,
  index: number,
  patch: Partial<Gloss>,
): Translate {
  return mapItem(exercise, itemId, (item) => ({
    ...item,
    gloss: item.gloss.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)),
  }));
}

export function addGloss(exercise: Translate, itemId: string, entry: Gloss): Translate {
  return mapItem(exercise, itemId, (item) => ({ ...item, gloss: [...item.gloss, entry] }));
}

export function removeGloss(exercise: Translate, itemId: string, index: number): Translate {
  return mapItem(exercise, itemId, (item) => ({
    ...item,
    gloss: item.gloss.filter((_, at) => at !== index),
  }));
}

/** `require` and `forbid` are edited in step 3; the operations live here with the rest. */
export function setGuards(
  exercise: Translate,
  itemId: string,
  kind: 'require' | 'forbid',
  guards: Guard[],
): Translate {
  return mapItem(exercise, itemId, (item) => ({ ...item, [kind]: guards }));
}

/**
 * Swap the two language labels.
 *
 * Only the labels move. `dir` is what decides which of them a sentence is read in, so
 * swapping the names of the languages without touching it is exactly the fix for the
 * commonest authoring slip — the two names typed the wrong way round.
 */
export function swapLangs(exercise: Translate): Translate {
  return {
    ...exercise,
    langs: { explain: exercise.langs.target, target: exercise.langs.explain },
  };
}

/**
 * Set the direction of the whole set.
 *
 * Away from `both`, every sentence is brought along: an item's own `dir` is only read when
 * the set is mixed, and leaving stale per-item directions behind would mean switching to
 * `both` later silently reshuffles which way each sentence reads.
 */
export function setDirection(exercise: Translate, dir: Translate['dir']): Translate {
  if (dir === 'both') return { ...exercise, dir };
  return { ...exercise, dir, items: exercise.items.map((item) => ({ ...item, dir })) };
}

function mapItem(exercise: Translate, itemId: string, change: (item: Item) => Item): Translate {
  return {
    ...exercise,
    items: exercise.items.map((item) => (item.id === itemId ? change(item) : item)),
  };
}
