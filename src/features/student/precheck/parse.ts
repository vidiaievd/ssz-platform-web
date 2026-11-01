import type {
  Feedback,
  FeedbackItem,
  FeedbackKind,
  FeedbackWord,
  PrecheckAi,
  PrecheckRemaining,
  PrecheckResult,
  ReadingPrompt,
} from './types';

/**
 * Silence instead of invention (plan 48 §6.4): an answer this file cannot read in full is no
 * answer at all. Fields are copied one by one, so nothing added upstream reaches the screen.
 */

const KINDS: readonly string[] = [
  'grammar',
  'lexis',
  'spelling',
  'pronunciation',
  'fluency',
  'content',
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function parseFeedback(raw: unknown): Feedback | null {
  if (!isRecord(raw) || typeof raw.summary !== 'string' || !Array.isArray(raw.items)) return null;
  const items: FeedbackItem[] = [];
  for (const entry of raw.items) {
    if (!isRecord(entry) || typeof entry.explanation !== 'string') continue;
    if (!KINDS.includes(String(entry.kind))) continue;
    items.push({
      kind: entry.kind as FeedbackKind,
      original: stringOrNull(entry.original),
      suggestion: stringOrNull(entry.suggestion),
      explanation: entry.explanation,
      severity: entry.severity === 'major' ? 'major' : 'minor',
    });
  }
  const words: FeedbackWord[] = [];
  for (const entry of Array.isArray(raw.words) ? raw.words : []) {
    if (!isRecord(entry) || typeof entry.text !== 'string') continue;
    words.push({
      text: entry.text,
      passageIndex: typeof entry.passageIndex === 'number' ? entry.passageIndex : null,
      accuracy: typeof entry.accuracy === 'number' ? entry.accuracy : null,
    });
  }
  return { summary: raw.summary, items, words };
}

function parseAi(raw: unknown): PrecheckAi | null {
  if (!isRecord(raw)) return null;
  switch (raw.status) {
    case 'ok':
      return { status: 'ok' };
    case 'refused':
      return {
        status: 'refused',
        reason: typeof raw.reason === 'string' ? raw.reason : 'unknown',
      };
    case 'failed':
      return {
        status: 'failed',
        errorCode: typeof raw.errorCode === 'string' ? raw.errorCode : 'unknown',
      };
    case 'not_asked':
      return {
        status: 'not_asked',
        reason: typeof raw.reason === 'string' ? raw.reason : 'unknown',
      };
    default:
      return null;
  }
}

function parseRemaining(raw: unknown): PrecheckRemaining | null {
  if (!isRecord(raw)) return null;
  const count = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : null;
  return { exercise: count(raw.exercise), learnerChecksApprox: count(raw.learnerChecksApprox) };
}

function parseReading(raw: unknown): PrecheckResult['reading'] {
  if (!isRecord(raw) || typeof raw.passPercent !== 'number' || !Array.isArray(raw.prompts)) {
    return null;
  }
  const prompts: ReadingPrompt[] = [];
  for (const entry of raw.prompts) {
    if (!isRecord(entry) || typeof entry.itemId !== 'string') continue;
    if (typeof entry.percent !== 'number') continue;
    prompts.push({ itemId: entry.itemId, percent: entry.percent, passed: entry.passed === true });
  }
  return { passPercent: raw.passPercent, prompts };
}

/** Null when the answer is not a check result this app can read. */
export function parsePrecheckResult(raw: unknown): PrecheckResult | null {
  if (!isRecord(raw)) return null;
  const ai = parseAi(raw.ai);
  if (ai === null) return null;
  return {
    selfCheck: raw.selfCheck ?? null,
    ai,
    feedback: ai.status === 'ok' ? parseFeedback(raw.feedback) : null,
    reading: parseReading(raw.reading),
    remaining: parseRemaining(raw.remaining),
  };
}
