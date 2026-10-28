import type {
  AiPronouncedWord,
  AiPronunciation,
  AiReading,
  AiReadingOp,
  AiReadingPrompt,
} from './types';

const PRONOUNCED_ERRORS = new Set(['none', 'mispronunciation', 'omission', 'insertion']);

/**
 * A `read_aloud` reading as the engine keeps it on a review (plan 82, step 7), copied field
 * by field into what a screen draws — or `null` when it is not one.
 *
 * Read defensively and narrowly: the engine's copy also holds the words heard with their
 * timings and the audio's length, which no screen draws, and whatever it gains later must
 * not reach a learner by inheritance. A prompt that cannot be read is left out rather than
 * failing the review; an op that cannot be read is left out of its prompt.
 */
export function readReading(raw: unknown): AiReading | null {
  if (!isRecord(raw) || !Array.isArray(raw.prompts)) return null;
  const passPercent = num(raw.passPercent);
  if (passPercent === null) return null;
  return {
    passPercent,
    prompts: raw.prompts.flatMap((p): AiReadingPrompt[] => {
      const prompt = readPrompt(p);
      return prompt === null ? [] : [prompt];
    }),
    carriedItemIds: Array.isArray(raw.carriedItemIds)
      ? raw.carriedItemIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

function readPrompt(raw: unknown): AiReadingPrompt | null {
  if (!isRecord(raw) || typeof raw.itemId !== 'string' || !isRecord(raw.check)) return null;
  const total = num(raw.check.total);
  const read = num(raw.check.read);
  const percent = num(raw.percent);
  if (total === null || read === null || percent === null || typeof raw.passed !== 'boolean') {
    return null;
  }
  return {
    itemId: raw.itemId,
    transcript: typeof raw.transcript === 'string' ? raw.transcript : '',
    ops: Array.isArray(raw.check.ops)
      ? raw.check.ops.flatMap((op): AiReadingOp[] => {
          const read = readOp(op);
          return read === null ? [] : [read];
        })
      : [],
    total,
    read,
    percent,
    passed: raw.passed,
    pronunciation: readPronunciation(raw.pronunciation),
    wordsPerMinute: num(raw.wordsPerMinute),
  };
}

function readOp(raw: unknown): AiReadingOp | null {
  if (!isRecord(raw)) return null;
  const focus = raw.focus === true;
  const i = num(raw.i);
  const heard = typeof raw.heard === 'string' ? raw.heard : null;
  const expected = typeof raw.expected === 'string' ? raw.expected : null;
  switch (raw.k) {
    case 'read':
      return i === null || heard === null
        ? null
        : { k: 'read', i, n: num(raw.n) ?? 1, heard, focus };
    case 'misread':
      return i === null || heard === null || expected === null
        ? null
        : { k: 'misread', i, expected, heard, focus };
    case 'missed':
      return i === null || expected === null ? null : { k: 'missed', i, expected, focus };
    case 'extra':
      return heard === null ? null : { k: 'extra', heard };
    default:
      return null;
  }
}

function readPronunciation(raw: unknown): AiPronunciation | null {
  if (!isRecord(raw)) return null;
  const accuracy = num(raw.accuracy);
  const fluency = num(raw.fluency);
  const completeness = num(raw.completeness);
  if (accuracy === null || fluency === null || completeness === null) return null;
  return {
    accuracy,
    fluency,
    completeness,
    prosody: num(raw.prosody),
    words: Array.isArray(raw.words)
      ? raw.words.flatMap((w): AiPronouncedWord[] => {
          if (!isRecord(w) || typeof w.text !== 'string') return [];
          const score = num(w.accuracy);
          if (score === null || typeof w.error !== 'string' || !PRONOUNCED_ERRORS.has(w.error)) {
            return [];
          }
          return [{ text: w.text, accuracy: score, error: w.error as AiPronouncedWord['error'] }];
        })
      : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
