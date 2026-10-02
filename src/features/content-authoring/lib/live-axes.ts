import type { DerivedProfile } from '@/lib/shared-kernel/skills';

import type {
  CoverageFocus,
  CoverageForm,
  CoverageModality,
  CoverageSkill,
  ExerciseAxes,
} from '../types';

/**
 * What the exercise trains as it stands in the builder, right now.
 *
 * Two answers exist and neither is complete on its own. The service knows where the
 * exercise is placed and what its author declared; the builder knows what the document
 * says this second, which is the whole point — an author who turns the audio on should
 * not have to save and reopen to find out that the exercise is now listening.
 *
 * So: the saved answer wins wherever it was decided by something the document cannot
 * move — an override, or where the exercise stands in its lesson — and the live document
 * wins over the two rungs it owns, itself and the template. The subject is never taken
 * from the draft: it comes from the atom graph, which the builder does not hold.
 */
export function mergeAxes(saved: ExerciseAxes | undefined, draft: DerivedProfile): ExerciseAxes {
  const channelIsSaved = saved?.skillSource === 'override' || saved?.skillSource === 'placement';

  return {
    skills: channelIsSaved ? saved.skills : (draft.skills as CoverageSkill[]),
    skillSource: channelIsSaved ? saved.skillSource : draft.skillSource,
    // The subject is the atom graph's to answer, and the graph is not in the builder.
    focus: saved?.focus ?? (draft.focus as CoverageFocus[]),
    focusSource: saved?.focusSource ?? draft.focusSource,
    // `form` has no override of its own: only the template and the document speak to it,
    // and the document in hand is newer than the one the service read.
    form: (saved?.skillSource === 'override' ? saved.form : draft.form) as CoverageForm,
    // Nothing writes a modality override yet and placement never moves it, so the live
    // document is the whole answer (plan 64, decision G).
    modality: draft.modality as CoverageModality,
  };
}
