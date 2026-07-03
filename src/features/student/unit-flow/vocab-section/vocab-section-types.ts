import type { ExpandedVocabItem } from '@/features/learning';

/** Vocab item enriched with pass-phase triage metadata. */
export interface VocabQueueItem extends ExpandedVocabItem {
  /** True when this is a splice confirmation re-check. */
  isCheck?: boolean;
  /** Tiebreaker key for spliced duplicates (uses Date.now()). */
  _uid?: number;
}

/** Vocab item enriched with SRS re-queue metadata. */
export interface VocabStudyQueueItem extends ExpandedVocabItem {
  /** How many times this card has been re-queued due to "Hard" (max 2). */
  _hitCount: number;
}

export type SrsRating = 'hard' | 'good' | 'easy';

export interface VocabPassResult {
  knownIds: Set<string>;
  newWords: ExpandedVocabItem[];
}

export interface VocabStudyResult {
  studied: number;
}

export interface VocabStats {
  total: number;
  known: number;
  studied: number;
}

export type VocabInternalPhase = 'pass' | 'all-known' | 'study' | 'done';
