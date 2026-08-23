import type {
  ShortAnswerDetails,
  ShortAnswerElementDetail,
  ShortAnswerItemDetail,
} from '@/features/content-authoring/types/review';
import type { Verdict } from '@/lib/shared-kernel/short-answer';

const VERDICTS = ['pass', 'partial', 'fail'] as const;

/**
 * Read the engine's reading of a set of open questions, defensively.
 *
 * Two templates answer to the code `short_answer`. The one this describes is the set of
 * comprehension questions graded against semantic elements; the other is the single
 * question with a list of accepted strings that 144 seeded exercises are still written in
 * (plan 51 §8 Q1), and its breakdown has no `items` at all. Both reach this queue, and
 * telling them apart by shape is the same rule the engine grades by — no version field
 * could work, since those 144 were written before any version existed.
 *
 * It refuses whole rather than in part, which is `readWritingTaskDetails`' rule and
 * matters more here (plan 51 §6.7). The breakdown is recomputed on every read against
 * the exercise as it stands *today*, so an author who reworked the key changes what an
 * already-submitted answer parses as. Dropping the questions that no longer parse would
 * leave a row reading `0 av 3 punkter` over a perfectly good answer — a lie the teacher
 * has no way to catch, where a missing analysis is visibly missing and the plain answer
 * is shown instead.
 *
 * Which is also why nothing here is defaulted. `covered`, `total` and `words` are numbers
 * the validator always writes; absent, they are evidence this is not that payload, not an
 * invitation to print a zero.
 */
export function readShortAnswerDetails(value: unknown): ShortAnswerDetails | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.items)) return null;

  const items: ShortAnswerItemDetail[] = [];
  for (const entry of raw.items) {
    const item = readItem(entry);
    if (item === null) return null;
    items.push(item);
  }

  const totalItems = readCount(raw.totalItems);
  const routedItems = readCount(raw.routedItems);
  const passedItems = readCount(raw.passedItems);
  const coveredElements = readCount(raw.coveredElements);
  const totalElements = readCount(raw.totalElements);
  if (
    totalItems === null ||
    routedItems === null ||
    passedItems === null ||
    coveredElements === null ||
    totalElements === null
  ) {
    return null;
  }

  return { totalItems, routedItems, passedItems, coveredElements, totalElements, items };
}

/**
 * One question, or nothing.
 *
 * `verdict: null` is the one absence that is data rather than damage: the author deleted
 * the question after the student answered it, and the engine reports the row anyway so
 * that the answer is read by someone. Everything else must be there.
 */
function readItem(value: unknown): ShortAnswerItemDetail | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.itemId !== 'string' || raw.itemId === '') return null;
  if (typeof raw.submitted !== 'string') return null;
  if (raw.routing !== 'pass' && raw.routing !== 'teacher') return null;

  let verdict: Verdict | null = null;
  if (raw.verdict !== null && raw.verdict !== undefined) {
    const known = VERDICTS.find((candidate) => candidate === raw.verdict);
    if (known === undefined) return null;
    verdict = known;
  }

  const covered = readCount(raw.covered);
  const total = readCount(raw.total);
  const words = readCount(raw.words);
  if (covered === null || total === null || words === null) return null;

  if (!Array.isArray(raw.elements)) return null;
  const elements: ShortAnswerElementDetail[] = [];
  for (const entry of raw.elements) {
    const element = readElement(entry);
    if (element === null) return null;
    elements.push(element);
  }

  return {
    itemId: raw.itemId,
    routing: raw.routing,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : null,
    verdict,
    submitted: raw.submitted,
    covered,
    total,
    tooShort: raw.tooShort === true,
    words,
    elements,
    model: typeof raw.model === 'string' ? raw.model : null,
  };
}

function readElement(value: unknown): ShortAnswerElementDetail | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id === '') return null;
  if (typeof raw.label !== 'string') return null;

  return {
    id: raw.id,
    label: raw.label,
    // The author writes required elements by default, and an element that arrived
    // without the flag is likelier to be one than not.
    required: raw.required !== false,
    hit: raw.hit === true,
    anchor: typeof raw.anchor === 'string' ? raw.anchor : null,
  };
}

function readCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}
