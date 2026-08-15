import {
  DEFAULT_FLOW,
  DEFAULT_LANGS,
  type ProjectedItem,
  type StudentProjection,
} from '@/lib/shared-kernel/translate';

/**
 * Accept the exercise only if what arrived is the masked projection.
 *
 * The stored content of this template and the projection built from it look alike —
 * both are a list of sentences with an `id`, a `dir` and a `source`. What separates
 * them is that the projection has already resolved which language each sentence is read
 * in and answered in (`sourceLang`, `answerLang`), and has already decided whether a hit
 * on the key closes an item (`exactPasses`). Neither is in the document.
 *
 * So a payload without them is not a projection with a few fields to fill in: it is the
 * stored document, which means the server did not project at all — and a server that did
 * not project also sent `expectedAnswers`, the accepted translations, into the browser.
 * The runner would work perfectly with them and the exercise would be pointless.
 *
 * Refusing keeps that visible. In practice it means an `exercise-engine` older than
 * phase 2 of plan 42; rebuilding the image is the fix.
 */
export function readTranslateProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null) return null;

  const raw = value as Partial<StudentProjection>;
  if (!Array.isArray(raw.items) || raw.items.length === 0) return null;
  if (typeof raw.exactPasses !== 'boolean') return null;
  if (raw.items.some((item) => !isProjectedItem(item))) return null;

  return {
    dir: raw.dir === 'both' || raw.dir === 'from_target' ? raw.dir : 'to_target',
    // Labels and settings are what the screen is arranged by, not what it is about: a
    // projection that lost one is still playable, and the fallbacks are the kernel's own
    // defaults rather than a guess made here.
    langs: { ...DEFAULT_LANGS, ...raw.langs },
    format: raw.format === 'single' ? 'single' : 'set',
    note: typeof raw.note === 'string' ? raw.note : '',
    items: raw.items,
    flow: { ...DEFAULT_FLOW, ...raw.flow },
    exactPasses: raw.exactPasses,
  };
}

function isProjectedItem(value: unknown): value is ProjectedItem {
  if (typeof value !== 'object' || value === null) return false;
  const { id, dir, source, sourceLang, answerLang } = value as Partial<ProjectedItem>;
  return (
    typeof id === 'string' &&
    id !== '' &&
    (dir === 'to_target' || dir === 'from_target') &&
    typeof source === 'string' &&
    typeof sourceLang === 'string' &&
    typeof answerLang === 'string'
  );
}
