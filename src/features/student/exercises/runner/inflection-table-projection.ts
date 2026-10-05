import type {
  ProjectedCell,
  ProjectedRow,
  ProjectedSettings,
  ProjectedSlot,
  StudentProjection,
} from '@/lib/shared-kernel/inflection-table';
import { REVEAL_KEYS } from '@/lib/shared-kernel/inflection-table';

/**
 * Accept the table only if what arrived is the student projection.
 *
 * Everything the key is made of lives in the other column (plan 69 §3.2, IT-X2): an asked
 * cell that carries a `value`, a cell or row that carries `accept`, `why` or a `dictId`, a
 * settings block that carries the pass mark. Any of them on the wire means the stored
 * document reached the browser — an engine older than phase 4, or a route that reached for
 * the authoring copy.
 *
 * The answer is to refuse, not to strip: stripping would leave a runner that works, a
 * verdict that is decoration, and nothing on any screen to say the key had been sent
 * (plan 50's finding; plans 53, 54, 66 and 67 repeat it).
 *
 * A given cell carries its form — that is the task — and a bank carries forms by design;
 * neither is a leak.
 */
export function readInflectionTableProjection(value: unknown): StudentProjection | null {
  if (!isRecord(value)) return null;
  if ('expected' in value || 'expectedAnswers' in value) return null;
  if (!Array.isArray(value['slots']) || !Array.isArray(value['rows'])) return null;

  const slots: ProjectedSlot[] = [];
  for (const entry of value['slots']) {
    if (!isRecord(entry)) return null;
    const { id, label, short } = entry;
    if (typeof id !== 'string' || id === '') return null;
    if (typeof label !== 'string' || label === '') return null;
    slots.push({ id, label, short: typeof short === 'string' && short !== '' ? short : label });
  }
  // One column is a short answer, not a table; the projection never deals fewer than two.
  if (slots.length < 2) return null;
  const slotIds = new Set(slots.map((s) => s.id));

  const rows: ProjectedRow[] = [];
  for (const entry of value['rows']) {
    if (!isRecord(entry)) return null;
    if ('dictId' in entry || 'accept' in entry || 'why' in entry) return null;
    const { id, lemma, gloss, cells: rawCells } = entry;
    if (typeof id !== 'string' || id === '') return null;
    if (typeof lemma !== 'string' || lemma === '') return null;
    if (!isRecord(rawCells)) return null;

    const cells: Record<string, ProjectedCell> = {};
    for (const [slotId, raw] of Object.entries(rawCells)) {
      if (!slotIds.has(slotId)) continue;
      if (!isRecord(raw)) return null;
      if ('accept' in raw || 'why' in raw) return null;

      if (raw['mode'] === 'prefill') {
        if (typeof raw['value'] !== 'string') return null;
        cells[slotId] = { mode: 'prefill', value: raw['value'] };
      } else if (raw['mode'] === 'ask') {
        // The key. The only thing an asked cell may add is the first letter, when the
        // author turned that hint on.
        if ('value' in raw) return null;
        const hint = raw['hint'];
        cells[slotId] =
          typeof hint === 'string' && hint !== '' ? { mode: 'ask', hint } : { mode: 'ask' };
      } else {
        return null;
      }
    }
    rows.push({ id, lemma, gloss: typeof gloss === 'string' ? gloss : '', cells });
  }

  const settings = readSettings(value['settings']);
  if (settings === null) return null;

  const rawBank = value['bank'];
  let bank: string[] | undefined;
  if (settings.input === 'bank') {
    // A bank-mode table with no bank is unanswerable, not leaky.
    if (!Array.isArray(rawBank) || !rawBank.every((f) => typeof f === 'string')) return null;
    bank = rawBank as string[];
  }

  const paradigm = isRecord(value['paradigm']) ? value['paradigm'] : {};
  return {
    instruction: typeof value['instruction'] === 'string' ? value['instruction'] : '',
    language: typeof value['language'] === 'string' ? value['language'] : '',
    paradigm: {
      id: typeof paradigm['id'] === 'string' ? paradigm['id'] : '',
      label: typeof paradigm['label'] === 'string' ? paradigm['label'] : '',
      lemmaLabel: typeof paradigm['lemmaLabel'] === 'string' ? paradigm['lemmaLabel'] : '',
    },
    slots,
    rows,
    ...(bank === undefined ? {} : { bank }),
    settings,
  };
}

/** Field by field rather than spread, so a field the runner has no business with cannot ride in. */
function readSettings(raw: unknown): ProjectedSettings | null {
  const s = isRecord(raw) ? raw : {};
  if ('threshold' in s) return null;

  const attempts = s['attempts'];
  const reveal = s['revealKey'];
  return {
    input: s['input'] === 'bank' ? 'bank' : 'type',
    // The server is the one that refuses a check, so a wrong guess here only shows a button
    // it refuses. Out of range reads as the author's smallest budget.
    attempts:
      typeof attempts === 'number' && Number.isInteger(attempts) && attempts >= 1 && attempts <= 4
        ? attempts
        : 1,
    revealKey: REVEAL_KEYS.find((k) => k === reveal) ?? 'afterLast',
    rowVerdict: s['rowVerdict'] !== false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
