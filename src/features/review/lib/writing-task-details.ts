import type {
  WritingTaskDetails,
  WritingTaskPointDetail,
} from '@/features/content-authoring/types/review';

const LENGTHS = ['empty', 'short', 'ok', 'long'] as const;

/**
 * Read the engine's reading of a free text, defensively.
 *
 * The breakdown is recomputed on every read from the exercise as it stands *today*, so a
 * submission made before the template was rewritten comes back shaped like the old one —
 * and the rubric on this screen is graded against a snapshot that outlives all of it. The
 * two ages meet here, which is why this returns `null` rather than a partly-filled object:
 * a facts line reading `0 ord · 0 avsnitt` over a 200-word essay would be a lie the
 * teacher has no way to catch, where a missing line is visibly missing.
 *
 * `points` is the field allowed to be empty without failing. A task whose author wrote no
 * must-cover points has nothing to chip, and that is an exercise, not a stale payload.
 */
export function readWritingTaskDetails(value: unknown): WritingTaskDetails | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const wordCount = readCount(raw.wordCount);
  const paragraphs = readCount(raw.paragraphs);
  if (wordCount === null || paragraphs === null) return null;

  const length = LENGTHS.find((candidate) => candidate === raw.length);
  if (length === undefined) return null;

  return {
    totalItems: readCount(raw.totalItems) ?? 1,
    passedItems: readCount(raw.passedItems) ?? 0,
    wordCount,
    paragraphs,
    uniqueWords: readCount(raw.uniqueWords) ?? 0,
    length,
    hitCount: readCount(raw.hitCount) ?? 0,
    neededCount: readCount(raw.neededCount) ?? 0,
    points: Array.isArray(raw.points) ? raw.points.flatMap(readPoint) : [],
  };
}

function readPoint(value: unknown): WritingTaskPointDetail[] {
  if (typeof value !== 'object' || value === null) return [];
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id === '') return [];

  return [
    {
      id: raw.id,
      text: typeof raw.text === 'string' ? raw.text : '',
      required: raw.required !== false,
      hit: raw.hit === true,
      ticked: raw.ticked === true,
    },
  ];
}

function readCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}
