import { DEFAULT_SETTINGS, type StudentProjection } from '@/lib/shared-kernel/writing-task';

/**
 * Accept the task only if what arrived is the student projection.
 *
 * Unlike the gapped templates, a `writing_task` document renders perfectly well with its
 * answer key still attached — the prompt, the points and the material are the same
 * either way. That is exactly what makes the check worth making here: a runner handed
 * the stored document would look right while holding the model answer and the point
 * keywords, which is the one thing IMPLEMENTATION.md's security rule forbids.
 *
 * So the two fields that only ever exist on the stored side are treated as proof that
 * the server did not project: a point with `keywords`, or a document with `model`. Both
 * mean an exercise-engine older than phase 2 of plan 50, and the answer to that is to
 * refuse and let the deployment stay visible — not to strip the key here, which would
 * hide the fact that it was ever sent.
 *
 * Settings are filled from the kernel's defaults rather than refused: they arrange the
 * screen, they are not what it is about, and a task missing `showPhrases` is still a
 * task worth writing.
 */
export function readWritingTaskProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const raw = value as Partial<StudentProjection> & { model?: unknown };
  if (typeof raw.prompt !== 'string' || raw.prompt.trim() === '') return null;
  if (!Array.isArray(raw.points)) return null;
  if (raw.model !== undefined) return null;
  if (
    raw.points.some((point) => point !== null && typeof point === 'object' && 'keywords' in point)
  )
    return null;

  const mode = raw.mode;
  if (
    mode !== 'letter' &&
    mode !== 'essay' &&
    mode !== 'picture' &&
    mode !== 'retell' &&
    mode !== 'free'
  ) {
    return null;
  }

  return {
    ...raw,
    mode,
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    prompt: raw.prompt,
    points: raw.points.filter(
      (point): point is StudentProjection['points'][number] =>
        typeof point === 'object' &&
        point !== null &&
        typeof (point as { id?: unknown }).id === 'string' &&
        typeof (point as { text?: unknown }).text === 'string',
    ),
    phrases: Array.isArray(raw.phrases)
      ? raw.phrases.filter((phrase): phrase is string => typeof phrase === 'string')
      : [],
    // The ceiling the graded card reads as `N / M poeng`. Derived from the rubric when
    // the server did not send it, so a card cannot end up dividing by a missing number.
    rubricMax:
      typeof raw.rubricMax === 'number' && raw.rubricMax > 0
        ? raw.rubricMax
        : (raw.rubric ?? []).reduce((sum, criterion) => sum + 3 * (criterion.weight ?? 1), 0),
    settings: readSettings(raw.settings),
  };
}

/**
 * The settings the runner arranges itself by, each one falling back to the author's own
 * default rather than to a guess.
 *
 * Listed field by field instead of spread over the kernel's `Settings`: that type also
 * holds the AI stage's switches, and spreading it would put settings into the projection
 * that the server deliberately does not send (projection.ts) — a runner reading them
 * would eventually grow the button that goes with them.
 */
function readSettings(raw: Partial<StudentProjection['settings']> | undefined) {
  const s = raw ?? {};
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  return {
    minWords: num(s.minWords, DEFAULT_SETTINGS.minWords),
    maxWords: num(s.maxWords, DEFAULT_SETTINGS.maxWords),
    timer: num(s.timer, DEFAULT_SETTINGS.timer),
    blockPaste: bool(s.blockPaste, DEFAULT_SETTINGS.blockPaste),
    autosave: bool(s.autosave, DEFAULT_SETTINGS.autosave),
    showWordCount: bool(s.showWordCount, DEFAULT_SETTINGS.showWordCount),
    showPlan: bool(s.showPlan, DEFAULT_SETTINGS.showPlan),
    showPhrases: bool(s.showPhrases, DEFAULT_SETTINGS.showPhrases),
    showRubric: s.showRubric ?? DEFAULT_SETTINGS.showRubric,
    showModel: s.showModel ?? DEFAULT_SETTINGS.showModel,
    passScore: num(s.passScore, DEFAULT_SETTINGS.passScore),
    revision: s.revision ?? DEFAULT_SETTINGS.revision,
  };
}
