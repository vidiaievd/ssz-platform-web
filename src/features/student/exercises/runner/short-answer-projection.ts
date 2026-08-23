import {
  DEFAULT_SETTINGS,
  type ProjectedQuestion,
  type ProjectedSettings,
  type StudentProjection,
} from '@/lib/shared-kernel/short-answer';

/**
 * Accept the set only if what arrived is the student projection.
 *
 * The stored document and the projection look almost alike — both are a list of
 * questions with an `id`, a `kind`, a `passage` and a `prompt` — because for this
 * template the key lives in its own column. What separates them is what the key column
 * put back: the projection reaches into it for one field only, the model answer, and
 * only under `showModel: 'always'`.
 *
 * So the tells are the key's own fields. A question carrying `elements` is the answer
 * written in the words the student is being asked to find; a question carrying `why` is
 * the explanation that belongs under a verdict; a `model` arriving while `showModel` is
 * not `always` is the author's answer arriving before it was earned. Any of them means
 * an `exercise-engine` older than phase 2 of plan 51.
 *
 * The answer to that is to refuse, not to strip the key here. Stripping would leave a
 * runner that works, an exercise that is pointless, and nothing on any screen to say the
 * key was ever sent (plan 50's finding, and plan 51 §7 phase 4 repeats it).
 *
 * A document of the old single-question form is refused too, by the same first check:
 * it has no `questions` at all. That is not a deployment fault but the 144 exercises
 * plan 51 §8 Q1 leaves live, and the reader dispatches them to their own runner before
 * ever getting here.
 */
export function readShortAnswerProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as { instruction?: unknown; questions?: unknown; settings?: unknown };
  if (!Array.isArray(raw.questions)) return null;

  const settings = readSettings(raw.settings);
  const questions: ProjectedQuestion[] = [];

  for (const item of raw.questions) {
    if (typeof item !== 'object' || item === null) return null;
    const q = item as Record<string, unknown>;

    if ('elements' in q || 'why' in q) return null;
    if ('model' in q && settings.showModel !== 'always') return null;

    const { id, prompt } = q as { id?: unknown; prompt?: unknown };
    if (typeof id !== 'string' || id === '') return null;
    if (typeof prompt !== 'string' || prompt.trim() === '') return null;

    const kind = q['kind'];
    const passage = q['passage'];
    const model = q['model'];

    questions.push({
      id,
      kind: kind === 'listening' || kind === 'opinion' ? kind : 'reading',
      prompt,
      // Present only for `reading` — the server decides that, and a passage that arrives
      // for another kind is shown as sent rather than second-guessed here.
      ...(typeof passage === 'string' && passage.trim() !== '' ? { passage } : {}),
      ...(typeof model === 'string' && model.trim() !== '' ? { model } : {}),
    });
  }

  return {
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    questions,
    settings,
  };
}

/**
 * The settings the runner arranges itself by, each falling back to the author's own
 * default rather than to a guess.
 *
 * Listed field by field rather than spread: the kernel's `Settings` also holds `typos`
 * and `caseless`, which the projection deliberately does not send because the client
 * does not grade. Spreading whatever arrived would quietly re-admit them.
 */
function readSettings(raw: unknown): ProjectedSettings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  const showModel = s['showModel'];
  const teacherReview = s['teacherReview'];
  const passRule = s['passRule'];

  return {
    passRule: passRule === 'n' ? 'n' : 'all',
    passN: num(s['passN'], DEFAULT_SETTINGS.passN),
    minWords: num(s['minWords'], DEFAULT_SETTINGS.minWords),
    showBreakdown: bool(s['showBreakdown'], DEFAULT_SETTINGS.showBreakdown),
    showModel:
      showModel === 'always' || showModel === 'never' || showModel === 'onClose'
        ? showModel
        : DEFAULT_SETTINGS.showModel,
    aiStage: bool(s['aiStage'], DEFAULT_SETTINGS.aiStage),
    aiGrammar: bool(s['aiGrammar'], DEFAULT_SETTINGS.aiGrammar),
    teacherReview:
      teacherReview === 'all' || teacherReview === 'none' || teacherReview === 'flagged'
        ? teacherReview
        : DEFAULT_SETTINGS.teacherReview,
    progress: bool(s['progress'], DEFAULT_SETTINGS.progress),
  };
}
