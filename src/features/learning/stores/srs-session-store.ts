'use client';

import { create } from 'zustand';

import type { ReviewRating, SrsCard } from '../types';

export type SrsPhase = 'entry' | 'session' | 'summary';
export type CardState = 'front' | 'revealed' | 'advancing';

export interface RatingError {
  rating: ReviewRating;
  message: string;
}

interface SrsSessionState {
  phase: SrsPhase;
  queue: SrsCard[];
  /** Current card index within queue. */
  index: number;
  cardState: CardState;
  /** Cards rated this session (regardless of rating). */
  reviewedCount: number;
  /** IDs of cards rated AGAIN. */
  againIds: string[];
  /** Count of cards rated GOOD or EASY — used for accuracy. */
  correctCount: number;
  /** Session start timestamp (ms). */
  startedAt: number | null;
  /** Session end timestamp (ms) — set when transitioning to summary. */
  endedAt: number | null;
  /** Timestamp when the current card was revealed (ms) — for latency tracking. */
  revealedAt: number | null;
  /**
   * One UUID per card reveal. Reused on retry so the server can deduplicate
   * a duplicate POST after a flaky reconnect.
   */
  currentIdempotencyKey: string | null;
  /** Set when a review POST fails with a non-429 error. Cleared on retry/advance. */
  ratingError: RatingError | null;
  dailyLimit: number;
  /** Set to true when the server returns 429. Terminal for the session. */
  limitHit: boolean;
}

interface SrsSessionActions {
  /** Seed the store from GET /due response. */
  seed: (data: { cards: SrsCard[]; dailyLimit: number }) => void;
  startSession: () => void;
  /** Show the answer side. Generates an idempotency key and starts the latency timer. */
  revealAnswer: () => void;
  /** Call after a successful review POST — advances to next card or summary. */
  advanceAfterRating: (rating: ReviewRating) => void;
  /** Re-queue only the "Again" cards for a second pass. */
  queueMisses: () => void;
  setPhase: (phase: SrsPhase) => void;
  setCardState: (cardState: CardState) => void;
  /** 429 — terminal. Jumps to summary with the limit banner. */
  setLimitHit: () => void;
  /** Set when a review POST returns a retriable error. */
  setRatingError: (error: RatingError) => void;
  /** Clear the inline error (user tapped Retry or card was advanced). */
  clearRatingError: () => void;
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
  revealedAt: null,
  currentIdempotencyKey: null,
  ratingError: null,
  dailyLimit: 20,
  limitHit: false,
};

export const useSrsSessionStore = create<SrsSessionState & SrsSessionActions>()((set, get) => ({
  ...initial,

  seed: ({ cards, dailyLimit }) =>
    set({ queue: cards, dailyLimit }),

  startSession: () =>
    set({ phase: 'session', index: 0, cardState: 'front', startedAt: Date.now() }),

  revealAnswer: () =>
    set({
      cardState: 'revealed',
      revealedAt: Date.now(),
      currentIdempotencyKey: crypto.randomUUID(),
      ratingError: null,
    }),

  advanceAfterRating: (rating) => {
    const { queue, index, reviewedCount, againIds, correctCount } = get();
    const newReviewed = reviewedCount + 1;
    const newAgain = rating === 'AGAIN' ? [...againIds, queue[index]!.id] : againIds;
    const newCorrect = rating === 'GOOD' || rating === 'EASY' ? correctCount + 1 : correctCount;
    const nextIndex = index + 1;
    const isLast = nextIndex >= queue.length;

    const shared = {
      reviewedCount: newReviewed,
      againIds: newAgain,
      correctCount: newCorrect,
      revealedAt: null,
      currentIdempotencyKey: null,
      ratingError: null,
    };

    if (isLast) {
      set({ ...shared, phase: 'summary', cardState: 'front', endedAt: Date.now() });
    } else {
      set({ ...shared, index: nextIndex, cardState: 'front' });
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
      endedAt: null,
      revealedAt: null,
      currentIdempotencyKey: null,
      ratingError: null,
      phase: 'session',
      limitHit: false,
    });
  },

  setPhase: (phase) => set({ phase }),
  setCardState: (cardState) => set({ cardState }),
  setLimitHit: () => set({ limitHit: true, phase: 'summary', endedAt: Date.now() }),
  setRatingError: (ratingError) => set({ ratingError, cardState: 'revealed' }),
  clearRatingError: () => set({ ratingError: null }),
  reset: () => set(initial),
}));
