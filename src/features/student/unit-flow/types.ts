import type { UnitPhase } from '@/features/learning';
import type { ExpandedVocabItem } from '@/features/learning';

export type { UnitPhase };

export interface UnitFlowState {
  phase: UnitPhase;
  /** Word IDs the student tapped "Already know it" in vocab-pass. */
  knownWordIds: Set<string>;
  /** Words to study — derived after vocab-pass completes. */
  newWords: ExpandedVocabItem[];
  /** Exercise IDs answered incorrectly in practice. */
  mistakes: string[];
}
