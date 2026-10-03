import {
  addBucket as addBucketTo,
  addItem as addItemTo,
  appendItems,
  assignBucket as assignBucketIn,
  parseBulk,
  removeBucket as removeBucketFrom,
  removeItem as removeItemFrom,
  replaceBuckets,
  setNoneLabel as setNoneLabelOn,
  setUseNone as setUseNoneOn,
  toggleAlso as toggleAlsoIn,
  updateBucket as updateBucketIn,
  updateItem as updateItemIn,
  type Bucket,
  type BucketPreset,
  type SortIntoBucketsContent,
  type SortItem,
} from '@/lib/shared-kernel/sort-into-buckets';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 66 §4.1).
 *
 * Every cascade — a deleted bucket leaving `also` and `fb.ov`, an item leaving with its
 * explanation, the refusal bucket unassigning what sat in it — is the kernel's and is
 * tested there (AC-B4, B6, B7, I1–I3, I8). What is here is only the shape: the builder
 * holds a document that carries more than the kernel's (`updatedAt`, the audio draft), and
 * the kernel returns the plain content. `keep` lays the result over the document so the
 * extras survive, which is also why none of these needs to know what they are.
 */
type Doc = SortIntoBucketsContent;

function keep<T extends Doc>(ex: T, next: Doc): T {
  return { ...ex, ...next };
}

export function setTitle<T extends Doc>(ex: T, title: string): T {
  return { ...ex, title };
}

export function setInstruction<T extends Doc>(ex: T, instruction: string): T {
  return { ...ex, instruction };
}

// ── Buckets ─────────────────────────────────────────────────────────────────

export function addBucket<T extends Doc>(ex: T): T {
  return keep(ex, addBucketTo(ex));
}

export function setBucket<T extends Doc>(ex: T, id: string, patch: Partial<Omit<Bucket, 'id'>>): T {
  return keep(ex, updateBucketIn(ex, id, patch));
}

export function removeBucket<T extends Doc>(ex: T, id: string): T {
  return keep(ex, removeBucketFrom(ex, id));
}

/**
 * Put the buckets in the order the drag handed back. The ids are the document's own, so
 * nothing but the order changes (AC-B7) — an id that is not there is ignored rather than
 * invented.
 */
export function reorderBuckets<T extends Doc>(ex: T, ids: readonly string[]): T {
  const byId = new Map(ex.buckets.map((b) => [b.id, b]));
  const next = ids.flatMap((id) => byId.get(id) ?? []);
  return next.length === ex.buckets.length ? { ...ex, buckets: next } : ex;
}

export function applyPreset<T extends Doc>(ex: T, preset: BucketPreset): T {
  return keep(ex, replaceBuckets(ex, preset.buckets));
}

export function setUseNone<T extends Doc>(ex: T, on: boolean): T {
  return keep(ex, setUseNoneOn(ex, on));
}

export function setNoneLabel<T extends Doc>(ex: T, label: string): T {
  return keep(ex, setNoneLabelOn(ex, label));
}

// ── Items ───────────────────────────────────────────────────────────────────

export function addItem<T extends Doc>(ex: T): T {
  return keep(ex, addItemTo(ex));
}

export function setItem<T extends Doc>(
  ex: T,
  id: string,
  patch: Partial<Pick<SortItem, 'text' | 'why'>>,
): T {
  return keep(ex, updateItemIn(ex, id, patch));
}

export function removeItem<T extends Doc>(ex: T, id: string): T {
  return keep(ex, removeItemFrom(ex, id));
}

/** Same as `reorderBuckets`: explanations are keyed by id and stay with their item (AC-I3). */
export function reorderItems<T extends Doc>(ex: T, ids: readonly string[]): T {
  const byId = new Map(ex.items.map((i) => [i.id, i]));
  const next = ids.flatMap((id) => byId.get(id) ?? []);
  return next.length === ex.items.length ? { ...ex, items: next } : ex;
}

/** Click a bucket pill: assigns, and the same pill again unassigns (AC-I1, AC-I2). */
export function assignBucket<T extends Doc>(ex: T, itemId: string, bucketId: string): T {
  return keep(ex, assignBucketIn(ex, itemId, bucketId));
}

export function toggleAlso<T extends Doc>(ex: T, itemId: string, bucketId: string): T {
  return keep(ex, toggleAlsoIn(ex, itemId, bucketId));
}

export function applyBulkPaste<T extends Doc>(ex: T, text: string): T {
  return keep(ex, appendItems(ex, parseBulk(ex, text).items));
}
