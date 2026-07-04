import type { ExerciseDisplay } from '@/features/content/types';

export type PlacementFlowState =
  | 'intro'
  | 'in-progress'
  | 'result'
  | 'skipped'
  | 'loading'
  | 'error';

export type PlacementPresentation = 'fullscreen' | 'inline';

export type PlacementLevelId = 'A1' | 'A2' | 'B1' | 'B2';

export type PlacementDirection = 'up' | 'down' | null;

export interface PlacementModuleRow {
  /** 1-based module number. */
  index: number;
  title: string;
  canDoStatement?: string;
}

export interface PlacementSessionState {
  flowState: PlacementFlowState;
  presentation: PlacementPresentation;
  /** Current adaptive level (0 = A1 … 3 = B2). */
  levelIndex: number;
  lastDirection: PlacementDirection;
  /** How many questions have been answered so far (0–5). */
  questionNumber: number;
  askedQuestionIds: string[];
  currentQuestion: ExerciseDisplay | null;
  /** Selected MCQ option id while in-progress. */
  selectedOption: string | null;
  /** Translate textarea value while in-progress. */
  translationText: string;
  /** 1-based module index where the student should start (set after test completes). */
  placedModuleIndex: number | null;
  placedLevelId: PlacementLevelId | null;
  /** Inline presentation only: user dismissed the card to a small text link. */
  cardDismissed: boolean;
}
