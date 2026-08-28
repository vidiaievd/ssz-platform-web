import {
  DEFAULT_SETTINGS,
  type ProjectedQuestion,
  type ProjectedSettings,
  type StudentProjection,
} from '@/lib/shared-kernel/multiple-choice';

/**
 * Accept the set only if what arrived is the student projection.
 *
 * For this template the check is unusually sharp, because the content column was built
 * with nothing in it to withhold: which option is right is neither a flag on an option
 * nor its position, but a map in the other column (plan 53 §3.2). So a `correct` on an
 * option, a `why` on a question or on an option, means the document itself arrived —
 * an `exercise-engine` older than phase 2, or a route that reached for the authoring
 * copy.
 *
 * The answer to that is to refuse, not to strip the key here. Stripping would leave a
 * runner that works, an exercise whose retry and 50/50 are decoration, and nothing on
 * any screen to say the key was ever sent (plan 50's finding; plan 53 §6.3 repeats it).
 *
 * A document of the old single-question form is refused by the first check — it has no
 * `questions` at all. That is not a deployment fault but the 121 exercises plan 53 §8 Q2
 * leaves live, and the reader dispatches them to their own runner before ever getting
 * here.
 */
export function readMultipleChoiceProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as { instruction?: unknown; questions?: unknown; settings?: unknown };
  if (!Array.isArray(raw.questions)) return null;

  const questions: ProjectedQuestion[] = [];

  for (const item of raw.questions) {
    if (typeof item !== 'object' || item === null) return null;
    const q = item as Record<string, unknown>;

    if ('why' in q) return null;

    const { id, stem, options } = q as { id?: unknown; stem?: unknown; options?: unknown };
    if (typeof id !== 'string' || id === '') return null;
    if (typeof stem !== 'string' || stem.trim() === '') return null;
    if (!Array.isArray(options)) return null;

    const read: ProjectedQuestion['options'] = [];
    for (const entry of options) {
      if (typeof entry !== 'object' || entry === null) return null;
      const o = entry as Record<string, unknown>;
      if ('correct' in o || 'why' in o) return null;

      const optionId = o['id'];
      const text = o['text'];
      if (typeof optionId !== 'string' || optionId === '') return null;
      if (typeof text !== 'string' || text.trim() === '') return null;
      read.push({ id: optionId, text });
    }

    // Fewer than two options is not a leak but an unanswerable question, and the
    // projection already drops those. One arriving here means the two sides disagree
    // about what is deliverable, which is worth refusing rather than rendering.
    if (read.length < 2) return null;

    const kind = q['kind'];
    const context = q['context'];

    questions.push({
      id,
      kind:
        kind === 'vocab' || kind === 'reading' || kind === 'listening' || kind === 'grammar'
          ? kind
          : 'grammar',
      stem,
      // Sent only where the author's passage is the student's to read — a `listening`
      // transcript is the author's own, and the server decides that, not this reader.
      ...(typeof context === 'string' && context.trim() !== '' ? { context } : {}),
      options: read,
    });
  }

  return {
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    questions,
    settings: readSettings(raw.settings),
  };
}

/**
 * The settings the runner arranges itself by, each falling back to the author's own
 * default rather than to a guess.
 *
 * Listed field by field rather than spread: the kernel's `Settings` also holds `shuffle`,
 * `shuffleQuestions`, `showWhyWrong` and `explainOnCorrect`, which the projection
 * deliberately does not send — the first two are already applied to the order that
 * arrived, and the last two decide what the *server* puts in a verdict. Spreading
 * whatever came would quietly re-admit them and invite the runner to act on them twice.
 */
function readSettings(raw: unknown): ProjectedSettings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  const retry = s['retry'];
  const layout = s['layout'];

  return {
    letters: bool(s['letters'], DEFAULT_SETTINGS.letters),
    layout: layout === 'grid' ? 'grid' : 'list',
    instant: bool(s['instant'], DEFAULT_SETTINGS.instant),
    retry:
      retry === 'none' || retry === 'one' || retry === 'unlimited' ? retry : DEFAULT_SETTINGS.retry,
    eliminate: bool(s['eliminate'], DEFAULT_SETTINGS.eliminate),
    progress: bool(s['progress'], DEFAULT_SETTINGS.progress),
  };
}
