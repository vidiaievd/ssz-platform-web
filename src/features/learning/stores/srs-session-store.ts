'use client';

import { create } from 'zustand';

import type { ReviewRating, SrsCard } from '../types';

export type SrsPhase = 'entry' | 'session' | 'summary';
export type CardState = 'front' | 'revealed' | 'advancing';

interface SrsSessionState {
  phase: SrsPhase;
  queue: SrsCard[];
  /** Current card index within queue. */
  index: number;
  cardState: CardState;
  /** Cards rated this session (regardless of rating). */
  reviewedCount: number;
  /** IDs of cards rated 'Again' (rating === 1). */
  againIds: string[];
  /** Count of cards rated Good (3) or Easy (4) — used for accuracy. */
  correctCount: number;
  /** Session start timestamp (ms). */
  startedAt: number | null;
  /** Session end timestamp (ms) — set when transitioning to summary. */
  endedAt: number | null;
  dailyLimit: number;
  streakDays: number;
  /** Set to true when the server returns 429. Terminal for the session. */
  limitHit: boolean;
  /** Last chosen rating before a potential retry. */
  pendingRating: ReviewRating | null;
}

interface SrsSessionActions {
  /** Seed the store from GET /due response. */
  seed: (data: {
    cards: SrsCard[];
    dailyLimit: number;
    streakDays: number;
  }) => void;
  startSession: () => void;
  revealAnswer: () => void;
  /** Call after a successful review POST; advances to next card or summary. */
  advanceAfterRating: (rating: ReviewRating, streakDays: number) => void;
  /** Re-queue only the "Again" cards for a second pass. */
  queueMisses: () => void;
  setPhase: (phase: SrsPhase) => void;
  setCardState: (cardState: CardState) => void;
  setLimitHit: () => void;
  setPendingRating: (rating: ReviewRating | null) => void;
  reset: () => void;
}

const initial: SrsSessionState = {
  phase: 'entry',
  queue: [],
  index: 0,
  cardState: 'front',
  reviewedCount: 0,
  againIds: [],
  correctCount: 0,
  startedAt: null,
  endedAt: null,
  dailyLimit: 20,
  streakDays: 0,
  limitHit: false,
  pendingRating: null,
};

export const useSrsSessionStore = create<SrsSessionState & SrsSessionActions>()((set, get) => ({
  ...initial,

  seed: ({ cards, dailyLimit, streakDays }) =>
    set({ queue: cards, dailyLimit, streakDays }),

  startSession: () =>
    set({ phase: 'session', index: 0, cardState: 'front', startedAt: Date.now() }),

  revealAnswer: () => set({ cardState: 'revealed' }),

  advanceAfterRating: (rating, streakDays) => {
    const { queue, index, reviewedCount, againIds, correctCount } = get();
    const newReviewed = reviewedCount + 1;
    const newAgain = rating === 1 ? [...againIds, queue[index]!.id] : againIds;
    const newCorrect = rating >= 3 ? correctCount + 1 : correctCount;
    const nextIndex = index + 1;
    const isLast = nextIndex >= queue.length;

    if (isLast) {
      set({
        reviewedCount: newReviewed,
        againIds: newAgain,
        correctCount: newCorrect,
        streakDays,
        phase: 'summary',
        cardState: 'front',
        endedAt: Date.now(),
      });
    } else {
      set({
        reviewedCount: newReviewed,
        againIds: newAgain,
        correctCount: newCorrect,
        streakDays,
        index: nextIndex,
        cardState: 'front',
        pendingRating: null,
      });
    }
  },

  queueMisses: () => {
    const { queue, againIds } = get();
    const misses = queue.filter((c) => againIds.includes(c.id));
    set({
      queue: misses,
      index: 0,
      cardState: 'front',
      reviewedCount: 0,
      againIds: [],
      correctCount: 0,
      startedAt: Date.now(),
      phase: 'session',
      limitHit: false,
    });
  },

  setPhase: (phase) => set({ phase }),
  setCardState: (cardState) => set({ cardState }),
  setLimitHit: () => set({ limitHit: true, phase: 'summary', endedAt: Date.now() }),
  setPendingRating: (pendingRating) => set({ pendingRating }),
  reset: () => set(initial),
}));
