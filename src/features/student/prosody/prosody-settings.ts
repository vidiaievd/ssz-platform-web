import type { ProsodyLens, ProsodyView } from './prosody-text';

/** How the learner reads the pronunciation (plan 86, §4i.2, Q-i7). */
export type ProsodyMode = 'meaning' | 'sentences' | 'text';

export interface ProsodySettings {
  mode: ProsodyMode;
  lens: ProsodyLens;
  /** «Show the legend» — the signs of the lens in use, under the text or the sentence card. */
  legend: boolean;
}

/** What is drawn inline on the text: a lens only when the whole text is shown with pronunciation. */
export function inlineView(settings: ProsodySettings): ProsodyView {
  return { lens: settings.mode === 'text' ? settings.lens : null };
}

/** Whether the pronunciation has to be fetched at all. */
export function wantsProsody(settings: ProsodySettings): boolean {
  return settings.mode !== 'meaning';
}
