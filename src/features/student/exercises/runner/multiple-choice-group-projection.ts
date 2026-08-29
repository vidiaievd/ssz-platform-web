import {
  DEFAULT_SETTINGS,
  type ProjectedColumn,
  type ProjectedRow,
  type ProjectedSettings,
  type ProjectedSource,
  type StudentProjection,
} from '@/lib/shared-kernel/multiple-choice-group';

/**
 * Accept the table only if what arrived is the student projection.
 *
 * For this template the key is `rows[].answer` — which shared column each statement
 * belongs in — and it lives in the other column entirely (plan 54 §3.2). So does the
 * author's line and, less obviously, the quote: a quote is the line of the passage that
 * proves the statement, which is the answer written in the author's words. A row that
 * arrives carrying any of the three is the stored document, not the projection — an
 * `exercise-engine` older than phase 2, or a route that reached for the authoring copy.
 *
 * The answer to that is to refuse, not to strip the three fields here. Stripping would
 * leave a runner that works, a table whose retry and «Vis fasit» are decoration, and
 * nothing on any screen to say the key had been sent (plan 50's finding; plans 51 and 53
 * repeat it).
 *
 * A document of the old form is refused by the first check — it has `items`, never
 * `rows`. That is not a deployment fault but the shape phase 7 leaves live, and the
 * reader dispatches it to `McqGroupSolver` before ever getting here.
 */
export function readMultipleChoiceGroupProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as {
    instruction?: unknown;
    source?: unknown;
    columns?: unknown;
    rows?: unknown;
    settings?: unknown;
  };
  if (!Array.isArray(raw.rows) || !Array.isArray(raw.columns)) return null;

  const columns: ProjectedColumn[] = [];
  for (const entry of raw.columns) {
    if (typeof entry !== 'object' || entry === null) return null;
    const c = entry as Record<string, unknown>;
    const id = c['id'];
    const label = c['label'];
    if (typeof id !== 'string' || id === '') return null;
    if (typeof label !== 'string' || label.trim() === '') return null;
    columns.push({ id, label });
  }

  // Fewer than two columns is not a leak but an unanswerable table, and the projection
  // already refuses to build one. One arriving here means the two sides disagree about
  // what is deliverable, which is worth refusing rather than rendering.
  if (columns.length < 2) return null;

  const rows: ProjectedRow[] = [];
  for (const entry of raw.rows) {
    if (typeof entry !== 'object' || entry === null) return null;
    const r = entry as Record<string, unknown>;

    if ('answer' in r || 'why' in r || 'quote' in r) return null;

    const id = r['id'];
    const text = r['text'];
    if (typeof id !== 'string' || id === '') return null;
    if (typeof text !== 'string' || text.trim() === '') return null;
    rows.push({ id, text });
  }

  return {
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    source: readSource(raw.source),
    columns,
    rows,
    settings: readSettings(raw.settings),
  };
}

/**
 * The passage, as far as the student is entitled to it.
 *
 * `text` is present only when the author attached one *and* left `showText` on — the
 * projection withholds it otherwise rather than sending it with a flag saying "do not
 * draw this", which is the same text one devtools tab away. So its presence is the whole
 * decision here; `settings.showText` is not consulted a second time.
 */
function readSource(raw: unknown): ProjectedSource {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const mode = s['mode'];
  const text = s['text'];
  const lessonId = s['lessonId'];

  return {
    mode: mode === 'inline' || mode === 'link' ? mode : 'none',
    label: typeof s['label'] === 'string' ? s['label'] : '',
    ...(typeof text === 'string' && text.trim() !== '' ? { text } : {}),
    ...(typeof lessonId === 'string' && lessonId !== '' ? { lessonId } : {}),
  };
}

/**
 * The settings the runner arranges itself by, each falling back to the author's own
 * default rather than to a guess.
 *
 * Listed field by field rather than spread, and the list is shorter than the kernel's
 * `Settings` on purpose. `shuffleRows` is already applied to the order that arrived;
 * `lockCorrect`, `revealKey` and `showWhy` decide what the *server* puts in a check
 * result, and a client acting on them could unfreeze a row the server froze or draw a key
 * it was not sent. Spreading whatever came would quietly re-admit all four.
 */
function readSettings(raw: unknown): ProjectedSettings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  const layout = s['layout'];
  const retry = s['retry'];
  const passThreshold = s['passThreshold'];

  return {
    numbering: bool(s['numbering'], DEFAULT_SETTINGS.numbering),
    layout: layout === 'cards' ? 'cards' : 'auto',
    retry:
      retry === 'none' || retry === 'one' || retry === 'unlimited' ? retry : DEFAULT_SETTINGS.retry,
    progress: bool(s['progress'], DEFAULT_SETTINGS.progress),
    showText: bool(s['showText'], DEFAULT_SETTINGS.showText),
    passThreshold:
      typeof passThreshold === 'number' && Number.isFinite(passThreshold)
        ? passThreshold
        : DEFAULT_SETTINGS.passThreshold,
  };
}
