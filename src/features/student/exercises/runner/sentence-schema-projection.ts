import {
  CLAUSE_IDS,
  DEFAULT_SETTINGS,
  type ClauseId,
  type Field,
  type OrderMode,
  type PrefillMode,
  type ProjectedItem,
  type ProjectedRow,
  type Settings,
  type StudentProjection,
} from '@/lib/shared-kernel/sentence-schema';

/**
 * Accept the set only if what arrived is the student projection.
 *
 * The stored document and the projection are not hard to tell apart, and the tells are
 * the key's own fields. A row carrying `chunks` is carrying `chunk.field` with them —
 * which field each piece belongs in, the whole answer. A row carrying `text` is carrying
 * the sentence in its correct order, which is the answer written out as a string. `why`
 * and `fb` are the teacher's explanations, owed after a verdict and not before.
 *
 * Any of them means an `exercise-engine` older than phase 2 of plan 52, or a
 * content-service that skipped the projection. The answer is to refuse, not to strip the
 * key here: stripping leaves a runner that works, an exercise that is pointless, and
 * nothing on any screen to say the key was ever sent (plan 50's finding, repeated by 51).
 *
 * A document that is not a set at all is refused by the first check. Nothing is left on
 * the old form (plan 52 §8 Q7), so one arriving is a leftover — and a runner that drew it
 * as an empty board would look like an exercise with nothing in it rather than one that
 * needs rewriting.
 */
export function readSentenceSchemaProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as {
    title?: unknown;
    instruction?: unknown;
    rows?: unknown;
    settings?: unknown;
  };
  if (!Array.isArray(raw.rows)) return null;

  const rows: ProjectedRow[] = [];
  for (const item of raw.rows) {
    if (typeof item !== 'object' || item === null) return null;
    const row = item as Record<string, unknown>;

    if ('chunks' in row || 'text' in row || 'why' in row || 'fb' in row) return null;

    const { id, source } = row as { id?: unknown; source?: unknown };
    if (typeof id !== 'string' || id === '') return null;

    const fields = readFields(row['fields']);
    const bank = readBank(row['bank']);
    if (fields === null || bank === null) return null;

    const clause = row['clause'];

    rows.push({
      id,
      clause: isClause(clause) ? clause : 'main',
      fields,
      bank,
      source: typeof source === 'string' ? source : '',
      counts: readCounts(row['counts']),
      start: readPlacement(row['start']),
    });
  }

  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    rows,
    settings: readSettings(raw.settings),
  };
}

const isClause = (value: unknown): value is ClauseId =>
  typeof value === 'string' && (CLAUSE_IDS as readonly string[]).includes(value);

/** The board's columns. A field carrying no id is a document, not a projection. */
function readFields(value: unknown): Field[] | null {
  if (!Array.isArray(value)) return null;

  const fields: Field[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const f = item as Record<string, unknown>;
    const id = f['id'];
    if (typeof id !== 'string' || id === '') return null;
    fields.push({
      id,
      short: typeof f['short'] === 'string' ? f['short'] : '',
      label: typeof f['label'] === 'string' ? f['label'] : '',
      hint: typeof f['hint'] === 'string' ? f['hint'] : '',
      optional: f['optional'] === true,
    });
  }
  return fields;
}

/** The pieces, in the order the server shuffled them into. Never reordered here. */
function readBank(value: unknown): ProjectedItem[] | null {
  if (!Array.isArray(value)) return null;

  const bank: ProjectedItem[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const i = item as Record<string, unknown>;
    // A piece that says which field it belongs in is the key, arriving one word at a
    // time. Same refusal as above, and the likeliest shape for it to arrive in.
    if ('field' in i || 'alt' in i) return null;
    const { id, text } = i as { id?: unknown; text?: unknown };
    if (typeof id !== 'string' || id === '' || typeof text !== 'string') return null;
    bank.push({ id, text });
  }
  return bank;
}

/**
 * Expected pieces per field — a partial key, sent only when the author asked for it.
 * Absent is the normal case and reads as "do not show numbers", never as zero.
 */
function readCounts(value: unknown): Record<string, number> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const counts: Record<string, number> = {};
  for (const [fieldId, n] of Object.entries(value)) {
    if (typeof n === 'number' && Number.isFinite(n)) counts[fieldId] = n;
  }
  return counts;
}

function readPlacement(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const board: Record<string, string[]> = {};
  for (const [fieldId, items] of Object.entries(value)) {
    if (Array.isArray(items)) {
      board[fieldId] = items.filter((item): item is string => typeof item === 'string');
    }
  }
  return board;
}

/**
 * The switches the runner arranges itself by, each falling back to the author's own
 * default rather than to a guess.
 *
 * Named field by field rather than spread: `order` is here because the runner says
 * nothing about it and must not start guessing, and `markEmpty` is carried because the
 * type declares it — nothing reads it, in the kernel or here (plan 52 Q6).
 */
function readSettings(raw: unknown): Settings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  const order = s['order'];
  const prefill = s['prefill'];

  return {
    labels: bool(s['labels'], DEFAULT_SETTINGS.labels),
    hints: bool(s['hints'], DEFAULT_SETTINGS.hints),
    counts: bool(s['counts'], DEFAULT_SETTINGS.counts),
    prefill: (prefill === 'first' || prefill === 'none'
      ? prefill
      : DEFAULT_SETTINGS.prefill) as PrefillMode,
    markEmpty: bool(s['markEmpty'], DEFAULT_SETTINGS.markEmpty),
    perField: bool(s['perField'], DEFAULT_SETTINGS.perField),
    hintAfterMistake: bool(s['hintAfterMistake'], DEFAULT_SETTINGS.hintAfterMistake),
    shuffle: bool(s['shuffle'], DEFAULT_SETTINGS.shuffle),
    extras: bool(s['extras'], DEFAULT_SETTINGS.extras),
    order: (order === 'loose' || order === 'strict' ? order : DEFAULT_SETTINGS.order) as OrderMode,
  };
}
