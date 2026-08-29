'use client';

import { create } from 'zustand';

import type { ExerciseDisplay } from '@/features/content/types';
import {
  PLACEMENT_START_INDEX,
  PLACEMENT_QUESTION_COUNT,
  DEFAULT_LEVEL_TO_MODULE,
  nextLevelIndex,
  directionFor,
  levelIdAt,
  computePlacementResult,
} from '../adaptive';
import type {
  PlacementFlowState,
  PlacementLevelId,
  PlacementPresentation,
  PlacementSessionState,
} from '../types';

export type { PlacementFlowState, PlacementPresentation };

interface PlacementActions {
  /**
   * Set the presentation mode and reset all session state.
   * Call this when the component mounts (before `startTest`).
   */
  configure: (presentation: PlacementPresentation) => void;

  /** Intro → loading. Triggers an external fetch of the first question. */
  startTest: () => void;
  /** Skip from any pre-result state → skipped. */
  skipTest: () => void;

  /** Store a freshly fetched question and move to in-progress. */
  setQuestion: (question: ExerciseDisplay) => void;
  /** Question fetch failed → error. */
  setError: () => void;
  /** Retry: error → loading (re-triggers an external fetch). */
  retryLoad: () => void;
  /**
   * Drop the current question without answering it and ask for another.
   *
   * Not an answer: the level does not move and the question count does not advance. The
   * id is remembered anyway, because `askedQuestionIds` is what keeps the next fetch from
   * handing back the very document that could not be played (plan 53, phase 6).
   */
  skipQuestion: () => void;

  /** Record an MCQ selection while in-progress. */
  selectOption: (id: string) => void;
  /** Update the translate textarea value while in-progress. */
  setTranslationText: (text: string) => void;

  /**
   * Record the answer, advance the adaptive level, and move to the next state.
   * - On questions 1–4: moves to 'loading' so the caller fetches the next question.
   * - On question 5: moves to 'result' and sets `placedLevelId` / `placedModuleIndex`.
   * - Pass `wasCorrect: false` for "I don't know this" (steps down without requiring a guess).
   *
   * @returns true when the test is complete (moved to result); false otherwise.
   */
  submitAnswer: (
    wasCorrect: boolean,
    levelToModule?: Readonly<Record<PlacementLevelId, number>>,
  ) => boolean;

  /**
   * Override: from the result screen, student chooses to start from Module 1
   * instead of the recommended module.
   */
  overrideToModule1: () => void;

  /** Inline card only: collapse to small text link (✕ dismiss). */
  dismissCard: () => void;
  /** Inline card only: re-open the card from the collapsed text link. */
  reopenCard: () => void;

  /** Hard reset to initial state (for retaking the test). */
  reset: () => void;
}

type PlacementStore = PlacementSessionState & PlacementActions;

function baseState(): PlacementSessionState {
  return {
    flowState: 'intro',
    presentation: 'inline',
    levelIndex: PLACEMENT_START_INDEX,
    lastDirection: null,
    questionNumber: 0,
    askedQuestionIds: [],
    currentQuestion: null,
    selectedOption: null,
    translationText: '',
    placedModuleIndex: null,
    placedLevelId: null,
    cardDismissed: false,
  };
}

export const usePlacementStore = create<PlacementStore>()((set, get) => ({
  ...baseState(),

  configure(presentation) {
    set({ ...baseState(), presentation });
  },

  startTest() {
    set({ flowState: 'loading' });
  },

  skipTest() {
    set({ flowState: 'skipped', currentQuestion: null });
  },

  setQuestion(question) {
    set({
      flowState: 'in-progress',
      currentQuestion: question,
      selectedOption: null,
      translationText: '',
    });
  },

  setError() {
    set({ flowState: 'error' });
  },

  retryLoad() {
    set({ flowState: 'loading' });
  },

  skipQuestion() {
    const { currentQuestion, askedQuestionIds } = get();
    set({
      flowState: 'loading',
      askedQuestionIds: currentQuestion
        ? [...askedQuestionIds, currentQuestion.id]
        : askedQuestionIds,
      currentQuestion: null,
      selectedOption: null,
      translationText: '',
    });
  },

  selectOption(id) {
    if (get().flowState === 'in-progress') {
      set({ selectedOption: id });
    }
  },

  setTranslationText(text) {
    if (get().flowState === 'in-progress') {
      set({ translationText: text });
    }
  },

  submitAnswer(wasCorrect, levelToModule = DEFAULT_LEVEL_TO_MODULE) {
    const { levelIndex, questionNumber, askedQuestionIds, currentQuestion } = get();
    const nextIdx = nextLevelIndex(levelIndex, wasCorrect);
    const direction = directionFor(levelIndex, nextIdx);
    const newQuestionNumber = questionNumber + 1;
    const newAskedIds = currentQuestion
      ? [...askedQuestionIds, currentQuestion.id]
      : askedQuestionIds;

    const isComplete = newQuestionNumber >= PLACEMENT_QUESTION_COUNT;

    if (isComplete) {
      const { levelId, moduleIndex } = computePlacementResult(nextIdx, levelToModule);
      set({
        flowState: 'result',
        levelIndex: nextIdx,
        lastDirection: direction,
        questionNumber: newQuestionNumber,
        askedQuestionIds: newAskedIds,
        currentQuestion: null,
        selectedOption: null,
        translationText: '',
        placedLevelId: levelId,
        placedModuleIndex: moduleIndex,
      });
    } else {
      set({
        flowState: 'loading',
        levelIndex: nextIdx,
        lastDirection: direction,
        questionNumber: newQuestionNumber,
        askedQuestionIds: newAskedIds,
        currentQuestion: null,
        selectedOption: null,
        translationText: '',
      });
    }

    return isComplete;
  },

  overrideToModule1() {
    set({ placedModuleIndex: 1, placedLevelId: levelIdAt(0) });
  },

  dismissCard() {
    set({ cardDismissed: true });
  },

  reopenCard() {
    const { presentation } = get();
    set({ ...baseState(), presentation, cardDismissed: false });
  },

  reset() {
    const { presentation } = get();
    set({ ...baseState(), presentation });
  },
}));
