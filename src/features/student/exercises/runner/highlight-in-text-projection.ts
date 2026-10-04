import type {
  ProjectedQuestion,
  ProjectedSettings,
  StudentProjection,
} from '@/lib/shared-kernel/highlight-in-text';

/** Names that belong to the key or to grading — none may reach a student (AC-S11). */
const ROOT_KEY = ['spans', 'orphans', 'threshold', 'penalty', 'missHint', 'fpHint'] as const;
const QUESTION_KEY = ['spans', 'why', 'missHint', 'fpHint'] as const;
const SETTINGS_KEY = ['threshold', 'penalty', 'showCount'] as const;

/**
 * Accept the passage only if what arrived is the student projection.
 *
 * The key for this template is the spans of each question, their `why`, the two hints, and
 * the threshold and penalty the score is computed with (plan 67 §3.2, AC-S11). A question,
 * the root or the settings arriving with any of them is the stored document, not the
 * projection — an engine older than phase 4, or a route that reached for the authoring copy.
 *
 * The answer is to refuse, not to strip the fields here: stripping would leave a runner that
 * works over a page holding the key, and nothing on any screen to say it had been sent
 * (plan 50's finding; plans 51, 53, 54 and 66 repeat it).
 */
export function readHighlightInTextProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (ROOT_KEY.some((k) => k in raw)) return null;

  const text = raw['text'];
  if (typeof text !== 'string') return null;
  if (!Array.isArray(raw['questions'])) return null;

  const questions: ProjectedQuestion[] = [];
  for (const entry of raw['questions'] as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const q = entry as Record<string, unknown>;
    if (QUESTION_KEY.some((k) => k in q)) return null;

    const id = q['id'];
    const prompt = q['prompt'];
    const count = q['count'];
    if (typeof id !== 'string' || id === '') return null;
    if (typeof prompt !== 'string' || prompt.trim() === '') return null;
    questions.push({
      id,
      prompt,
      unit: q['unit'] === 'phrase' ? 'phrase' : 'word',
      // A count the projection did not mean to give is not shown (AC-S10).
      count: typeof count === 'number' && Number.isInteger(count) && count > 0 ? count : null,
    });
  }

  const settings = readSettings(raw['settings']);
  if (settings === null) return null;

  return {
    instruction: typeof raw['instruction'] === 'string' ? raw['instruction'] : '',
    text,
    paragraphs: readParagraphs(raw['paragraphs']),
    questions,
    settings,
  };
}

/**
 * Listed field by field rather than spread, so a field the runner has no business with
 * cannot ride in. `revealKey` is read although it decides how much of the key the *server*
 * sends: the runner must know before the first check whether «Vis fasit» exists.
 */
function readSettings(raw: unknown): ProjectedSettings | null {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (SETTINGS_KEY.some((k) => k in s)) return null;
  const attempts = s['attempts'];
  return {
    // 0 is "no limit". Anything else out of range is read as no limit too: the server is
    // the one that refuses a check, so a wrong guess here only shows a button it refuses.
    attempts: attempts === 1 || attempts === 2 || attempts === 3 ? attempts : 0,
    hints: s['hints'] === true,
    revealKey: s['revealKey'] === true,
  };
}

/** Carried for completeness; the renderer splits the text itself, with the same kernel. */
function readParagraphs(raw: unknown): Array<[number, number]> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is [number, number] =>
      Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number',
  );
}
