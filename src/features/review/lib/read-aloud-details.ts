import type {
  ReadAloudDetails,
  ReadAloudPromptDetail,
} from '@/features/content-authoring/types/review';

const MODES = ['read', 'monologue', 'dialogue'] as const;

/**
 * Read the engine's view of a `read_aloud` submission, defensively — and whole or not at all.
 *
 * The prompts are what the reviewer's screen is built of: one block each, with a player, a
 * rubric and a comment. A prompt that cannot be read would be a recording the teacher cannot
 * mark, and the server would then refuse the verdict for a mark that was never offered — so a
 * single bad prompt refuses the lot, and the screen falls back to its "no analysis" note
 * (prior art: `readWritingTaskDetails`).
 *
 * `revision` is the one field read leniently. A breakdown from before it existed defaults to
 * `return`, which only changes the label of the button, never what the verdict does.
 */
export function readReadAloudDetails(value: unknown): ReadAloudDetails | null {
  const raw = record(value);
  if (raw === null || !Array.isArray(raw.prompts)) return null;

  const mode = MODES.find((candidate) => candidate === raw.mode);
  if (mode === undefined) return null;

  const prompts: ReadAloudPromptDetail[] = [];
  for (const entry of raw.prompts) {
    const prompt = readPrompt(entry);
    if (prompt === null) return null;
    prompts.push(prompt);
  }
  if (prompts.length === 0) return null;

  return {
    totalItems: count(raw.totalItems) ?? prompts.length,
    passedItems: count(raw.passedItems) ?? 0,
    mode,
    revision: raw.revision === 'once' ? 'once' : 'return',
    prompts,
  };
}

function readPrompt(value: unknown): ReadAloudPromptDetail | null {
  const raw = record(value);
  if (raw === null || typeof raw.itemId !== 'string' || raw.itemId === '') return null;

  const recording = record(raw.recording);
  if (recording === null || typeof recording.assetId !== 'string' || recording.assetId === '') {
    return null;
  }

  return {
    itemId: raw.itemId,
    label: typeof raw.label === 'string' ? raw.label : '',
    material: readMaterial(raw.material),
    note: typeof raw.note === 'string' ? raw.note : '',
    focus: Array.isArray(raw.focus) ? raw.focus.flatMap(readFocus) : [],
    minSeconds: count(raw.minSeconds),
    maxSeconds: count(raw.maxSeconds),
    recording: {
      assetId: recording.assetId,
      seconds: seconds(recording.seconds) ?? 0,
      takes: count(recording.takes) ?? 1,
    },
    carried: readCarried(raw.carried),
  };
}

/** A malformed ruling is not one: the prompt then reads as new, and the teacher marks it. */
function readCarried(value: unknown): ReadAloudPromptDetail['carried'] {
  const raw = record(value);
  if (raw === null) return null;
  const attempt = count(raw.attempt);
  const max = count(raw.max);
  const points = count(raw.points);
  if (attempt === null || attempt < 1 || max === null || points === null) return null;
  return {
    attempt,
    points,
    max,
    comment: typeof raw.comment === 'string' ? raw.comment : '',
  };
}

function readMaterial(value: unknown): ReadAloudPromptDetail['material'] {
  const raw = record(value);
  if (raw === null) return null;

  if (raw.kind === 'read' && typeof raw.text === 'string') return { kind: 'read', text: raw.text };

  if (raw.kind === 'dialogue') {
    return {
      kind: 'dialogue',
      situation: typeof raw.situation === 'string' ? raw.situation : '',
      partner: typeof raw.partner === 'string' ? raw.partner : '',
    };
  }

  if (raw.kind === 'monologue') {
    const image = record(raw.image);
    return {
      kind: 'monologue',
      image:
        image !== null && typeof image.assetId === 'string' && image.assetId !== ''
          ? {
              assetId: image.assetId,
              caption: typeof image.caption === 'string' ? image.caption : '',
              alt: typeof image.alt === 'string' ? image.alt : '',
            }
          : null,
      plan: Array.isArray(raw.plan)
        ? raw.plan.flatMap((point) => {
            const p = record(point);
            return p !== null && typeof p.id === 'string' && typeof p.text === 'string'
              ? [{ id: p.id, text: p.text, required: p.required !== false }]
              : [];
          })
        : [],
    };
  }

  return null;
}

function readFocus(value: unknown): ReadAloudPromptDetail['focus'] {
  const raw = record(value);
  if (raw === null || typeof raw.word !== 'string' || raw.word.trim() === '') return [];
  return [
    {
      id: typeof raw.id === 'string' ? raw.id : raw.word,
      word: raw.word,
      note: typeof raw.note === 'string' ? raw.note : '',
    },
  ];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function count(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function seconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
