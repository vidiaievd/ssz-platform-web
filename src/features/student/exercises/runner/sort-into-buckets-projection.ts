import type {
  ProjectedBucket,
  ProjectedItem,
  ProjectedSettings,
  StudentProjection,
} from '@/lib/shared-kernel/sort-into-buckets';

/**
 * Accept the board only if what arrived is the student projection.
 *
 * The key for this template is `bucketId` / `also` on an item, `why` beside it, `rule` on
 * a bucket and the whole `fb` map, and every one of them lives in the other column
 * (plan 66 §3.2). A tile or zone that arrives carrying any of them is the stored document,
 * not the projection — an engine older than phase 4, or a route that reached for the
 * authoring copy.
 *
 * The answer is to refuse, not to strip the fields here: stripping would leave a runner
 * that works, a retry that is decoration, and nothing on any screen to say the key had
 * been sent (plan 50's finding; plans 51, 53 and 54 repeat it).
 */
export function readSortIntoBucketsProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as {
    instruction?: unknown;
    buckets?: unknown;
    items?: unknown;
    settings?: unknown;
    fb?: unknown;
  };
  if (!Array.isArray(raw.buckets) || !Array.isArray(raw.items)) return null;
  if ('fb' in raw) return null;

  const buckets: ProjectedBucket[] = [];
  for (const entry of raw.buckets) {
    if (typeof entry !== 'object' || entry === null) return null;
    const b = entry as Record<string, unknown>;
    if ('rule' in b) return null;

    const id = b['id'];
    const label = b['label'];
    const hint = b['hint'];
    if (typeof id !== 'string' || id === '') return null;
    if (typeof label !== 'string' || label.trim() === '') return null;
    buckets.push({
      id,
      label,
      ...(typeof hint === 'string' && hint.trim() !== '' ? { hint } : {}),
    });
  }

  // Fewer than two zones is not a leak but an unanswerable board; the projection already
  // refuses to build one, so one arriving means the two sides disagree about what is
  // deliverable — worth refusing rather than rendering.
  if (buckets.length < 2) return null;

  const items: ProjectedItem[] = [];
  for (const entry of raw.items) {
    if (typeof entry !== 'object' || entry === null) return null;
    const i = entry as Record<string, unknown>;
    if ('bucketId' in i || 'also' in i || 'why' in i) return null;

    const id = i['id'];
    const text = i['text'];
    const mediaId = i['mediaId'];
    if (typeof id !== 'string' || id === '') return null;
    if (typeof text !== 'string' || text.trim() === '') return null;
    items.push({
      id,
      text,
      ...(typeof mediaId === 'string' && mediaId !== '' ? { mediaId } : {}),
    });
  }

  return {
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    buckets,
    items,
    settings: readSettings(raw.settings),
  };
}

/**
 * Listed field by field rather than spread, so a field the runner has no business with
 * cannot ride in. `revealKey` is read although it decides how much of the key the *server*
 * sends: the runner must know before the first check whether «Vis riktig plassering»
 * exists, and knowing a key can be shown is not the key.
 */
function readSettings(raw: unknown): ProjectedSettings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const attempts = s['attempts'];
  const threshold = s['threshold'];

  return {
    showRemaining: s['showRemaining'] === true,
    revealKey: s['revealKey'] !== false,
    // 0 is "no limit". Anything else out of range is read as no limit too: the server is
    // the one that refuses a check, so a wrong guess here only shows a button it refuses.
    attempts: attempts === 1 || attempts === 2 || attempts === 3 ? attempts : 0,
    threshold: typeof threshold === 'number' && Number.isFinite(threshold) ? threshold : 70,
  };
}
