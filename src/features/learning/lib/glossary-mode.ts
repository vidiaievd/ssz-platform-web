export type GlossaryMode = 'translation' | 'definition';

/** B2+ readers get target-language definitions instead of L1 translations. */
export function getGlossaryMode(cefrLevel: string): GlossaryMode {
  return cefrLevel === 'B2' || cefrLevel === 'C1' || cefrLevel === 'C2' ? 'definition' : 'translation';
}
