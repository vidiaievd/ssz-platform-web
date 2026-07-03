/* ─── SRS ─────────────────────────────────────────────────────────── */

export type ReviewRating = 1 | 2 | 3 | 4;

export interface SrsCardFront {
  word: string;
  phonetic?: string;
  pos?: string;
  audioSrc?: string;
}

export interface SrsCardBack {
  definition: string;
  translation?: string;
  examples?: string[];
  imageSrc?: string;
}

export interface SrsCard {
  id: string;
  contentType: 'EXERCISE' | 'VOCABULARY_WORD';
  contentId: string;
  front: SrsCardFront;
  back: SrsCardBack;
  stability?: number;
  difficulty?: number;
  dueAt: string;
}

export interface SrsDueResponse {
  dueCount: number;
  streakDays: number;
  dailyLimit: number;
  reviewedToday: number;
  cards: SrsCard[];
}

export interface ReviewRequest {
  rating: ReviewRating;
  latencyMs: number;
  idempotencyKey: string;
}

export interface ReviewResponse {
  nextDueAt: string;
  intervalLabel: string;
  streakDays: number;
  milestone?: string;
}

export interface SrsHeatmapDay {
  date: string;
  count: number;
}

export interface SrsStats {
  retentionRate: number;
  matureCount: number;
  youngCount: number;
  totalDue: number;
  heatmap: SrsHeatmapDay[];
}

/* ─── Progress ────────────────────────────────────────────────────── */

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  moduleId: string;
  status: LessonProgressStatus;
  score?: number;
  completedAt?: string;
}

export interface ModuleProgress {
  moduleId: string;
  status: LessonProgressStatus;
  completedLessons: number;
  totalLessons: number;
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  modules: ModuleProgress[];
  lessons: LessonProgress[];
}

/* ─── Mastery ─────────────────────────────────────────────────────── */

export interface SkillMastery {
  skill: string;
  masteryPercent: number;
  successCount: number;
  attemptCount: number;
}

export interface CourseMastery {
  courseId: string;
  overallMastery: number;
  bySkill: SkillMastery[];
}

/* ─── Can-do ──────────────────────────────────────────────────────── */

export type CanDoState = 'locked' | 'in-progress' | 'unlocked';

export interface CanDoItem {
  id: string;
  descriptor: string;
  cefrLevel?: string;
  moduleId: string;
  evidenceCount: number;
  unlockedAt?: string;
  state: CanDoState;
}

export interface CanDoResponse {
  items: CanDoItem[];
}

/* ─── Expanded module (unit payload) ─────────────────────────────── */

export interface ExpandedVocabItem {
  id: string;
  word: string;
  pos: string;
  ipa?: string;
  audioUrl?: string;
  translation: string;
  example?: string;
  exampleAudioUrl?: string;
}

export interface ExpandedGrammarExample {
  target: string;
  translation: string;
}

export interface ExpandedGrammarRule {
  id: string;
  title: string;
  explanation: string;
  examples: ExpandedGrammarExample[];
}

export interface ExpandedLesson {
  id: string;
  title: string;
  bodyMarkdown: string;
  audioUrl?: string;
  estimatedMinutes: number;
}

export interface ExpandedExerciseRef {
  id: string;
  type: string;
}

export interface ExpandedModule {
  id: string;
  title: string;
  position: number;
  cefrLevel: string;
  lesson: ExpandedLesson;
  vocabulary: ExpandedVocabItem[];
  grammar?: ExpandedGrammarRule;
  exercises: ExpandedExerciseRef[];
  canDoDescriptors: CanDoItem[];
}

export interface UnitPayload {
  module: ExpandedModule;
  progress: ModuleProgress;
}

/* ─── Course Home composite ──────────────────────────────────────── */

export interface CourseHomePayload {
  progress: CourseProgress;
  mastery: CourseMastery;
  srsDueCount: number;
  srsStreakDays: number;
  canDo: CanDoResponse;
}
