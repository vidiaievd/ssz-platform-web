import type {
  ProjectedSegment,
  ProjectedSettings,
  StudentProjection,
} from '@/lib/shared-kernel/dictation';

/** Names that belong to the key or to grading — none may reach a student (AC-X2, AC-R3). */
const ROOT_KEY = ['orphans', 'marking', 'threshold', 'language', 'transcript'] as const;
const SEGMENT_KEY = ['text', 'why', 'focus'] as const;
const SETTINGS_KEY = ['threshold'] as const;

/**
 * Accept the dictation only if what arrived is the student projection.
 *
 * The key for this template is every sentence, its reason and its focus words, the orphans,
 * and the marking rules and pass mark the check is computed with (plan 68 §3.2). A segment,
 * the root or the settings arriving with any of them is the stored document, not the
 * projection — an engine older than phase 4, or a route that reached for the authoring copy.
 *
 * The answer is to refuse, not to strip the fields here: stripping would leave a runner that
 * works over a page holding the key, and nothing on any screen to say it had been sent
 * (plan 50's finding; plans 51, 53, 54, 66 and 67 repeat it).
 *
 * The same reader serves the attempt's projection and the reader card's, which reads the
 * display projection content-service hands out before any attempt exists.
 */
export function readDictationProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (ROOT_KEY.some((k) => k in raw)) return null;
  if (!Array.isArray(raw['segments'])) return null;

  const segments: ProjectedSegment[] = [];
  for (const entry of raw['segments'] as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const s = entry as Record<string, unknown>;
    if (SEGMENT_KEY.some((k) => k in s)) return null;

    const id = s['id'];
    if (typeof id !== 'string' || id === '') return null;
    const count = s['wordCount'];
    segments.push(
      // A count the projection did not mean to give is not shown (AC-R3).
      typeof count === 'number' && Number.isInteger(count) && count > 0
        ? { id, wordCount: count }
        : { id },
    );
  }

  const settings = readSettings(raw['settings']);
  if (settings === null) return null;

  return {
    instruction: typeof raw['instruction'] === 'string' ? raw['instruction'] : '',
    mode: raw['mode'] === 'whole' ? 'whole' : 'segments',
    segments,
    settings,
  };
}

/**
 * Listed field by field rather than spread, so a field the runner has no business with
 * cannot ride in. `revealKey` is read although it decides what the *server* sends: the
 * runner must know before the first check whether «Vis fasit» exists.
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
    showWordCount: s['showWordCount'] === true,
  };
}
