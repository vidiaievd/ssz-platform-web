/* ─── SRS ─────────────────────────────────────────────────────────── */

export type ReviewRating = 1 | 2 | 3 | 4;

export interface SrsCardSentence {
  target: string;
  translation: string;
}

export interface SrsCardFront {
  word: string;
  pos?: string;
  audioUrl?: string;
  listId?: string;
  listName?: string;
}

export interface SrsCardBack {
  definition: string;
  sentences: SrsCardSentence[];
  imageUrl?: string;
}

export type SrsCardStatus = 'due' | 'suspended';
export type SrsCardDirection = 'forward' | 'reverse';

export interface SrsCardPredicted {
  label: string;
}

export interface SrsCard {
  id: string;
  status: SrsCardStatus;
  direction: SrsCardDirection;
  front: SrsCardFront;
  back: SrsCardBack;
  predicted: {
    '1': SrsCardPredicted;
    '2': SrsCardPredicted;
    '3': SrsCardPredicted;
    '4': SrsCardPredicted;
  };
}

export interface SrsDueResponse {
  dueCount: number;
  streakDays: number;
  dailyLimit: number;
  reviewedToday: number;
  cards: SrsCard[];
}

export interface SrsSettings {
  dailyLimit: number;
  audio: boolean;
  preferReverse: boolean;
  disabledAudioPairs: string[];
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

/** Upserts a student's progress on one content item (BE3.3 completion). */
export interface UpsertProgressRequest {
  contentType: string;
  contentId: string;
  timeSpentSeconds: number;
  score?: number;
  completed: boolean;
}

export interface ProgressRecord {
  id: string;
  userId: string;
  contentRef: { type: string; id: string };
  status: string;
  attemptsCount: number;
  lastAttemptAt: string | null;
  timeSpentSeconds: number;
  score: number | null;
  completedAt: string | null;
  needsReviewSince: string | null;
  reviewResolvedAt: string | null;
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
  /**
   * Per-language morphology paradigm (from VocabularyItem.grammaticalProperties).
   * For Norwegian this carries `gender` plus noun/verb/adjective forms
   * (e.g. plural_form, present_tense, neuter_form). Language-specific shape,
   * so values are kept as a loose string map for the forms table to render.
   */
  grammaticalProperties?: Record<string, string>;
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

/* ─── Unit contents (reader sidebar/footer nav data source, BE3.1/BE3.3) ─── */

export type UnitContentsItemStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface UnitContentsItem {
  id: string;
  contentType: string;
  contentId: string;
  title: string | null;
  lessonKind: string | null;
  durationMinutes: number | null;
  xpReward: number | null;
  status: UnitContentsItemStatus;
}

export interface UnitContentsSection {
  id: string;
  title: string;
  items: UnitContentsItem[];
}

export interface UnitContentsResult {
  moduleId: string;
  moduleTitle: string | null;
  sections: UnitContentsSection[];
  ungroupedItems: UnitContentsItem[];
}

/* ─── Unit summary (for Course Home unit list) ───────────────────── */

export type UnitStatus = 'done' | 'active' | 'locked';

export interface UnitSummary {
  id: string;
  position: number;
  title: string;
  status: UnitStatus;
  completedLessons: number;
  totalLessons: number;
}

/* ─── Progress dashboard (B8) ───────────────────────────────────── */

export type ProgressCanDoState = 'mastered' | 'completed' | 'in-progress';

export interface ProgressCanDo {
  id: string;
  /** First-person can-do statement, e.g. "I can order food in a café" */
  text: string;
  skill: string;
  module: string;
  /** Human-readable date string or null when in-progress */
  date: string | null;
  state: ProgressCanDoState;
  /** 0–100; only present when state === 'in-progress' */
  pct?: number;
}

export type ProgressSkillId = 'reading' | 'listening' | 'vocab' | 'grammar';

export interface ProgressSkillMastery {
  id: ProgressSkillId;
  label: string;
  /** 0–100: "did it" (completed exercises) */
  completed: number;
  /** 0–100: "retained it" (passed SRS reviews); always ≤ completed */
  mastered: number;
  /** e.g. "A1→A2" */
  level: string;
}

export interface ProgressSrsStats {
  dueToday: number;
  reviewedToday: number;
  /** 0–100 */
  retention: number;
  streak: number;
  bestStreak: number;
  totalItems: number;
  maturedItems: number;
}

export type ProgressModuleStatus = 'mastered' | 'completed' | 'active' | 'locked';

export interface ProgressModule {
  id: string;
  title: string;
  /** 0–100 */
  completed: number;
  /** 0–100 */
  mastered: number;
  candos: number;
  status: ProgressModuleStatus;
}

export interface ProgressStudentInfo {
  id: string;
  name: string;
  courseName: string;
  startedAt: string;
}

export interface ProgressOverview {
  student: ProgressStudentInfo;
  canDos: ProgressCanDo[];
  mastery: ProgressSkillMastery[];
  srs: ProgressSrsStats;
  modules: ProgressModule[];
}

/* ─── Assignments (B7) ──────────────────────────────────────────── */

export type AssignmentMode = 'graded' | 'written';

export type AssignmentStatus =
  | 'active'
  | 'overdue'
  | 'submitted'
  | 'in-review'
  | 'returned'
  | 'completed';

export interface Assignment {
  id: string;
  title: string;
  mode: AssignmentMode;
  skill: string;
  module: string;
  teacher: string;
  due: string;
  dueRel: string;
  overdueDays: number;
  status: AssignmentStatus;
  brief: string;
  /* graded only */
  items?: number;
  est?: string;
  score?: number;
  /* written only */
  submittedAt?: string;
  returnedAt?: string;
  feedback?: string;
}

export interface AssignmentListResponse {
  assignments: Assignment[];
}

/* MCQ question delivered to the graded runner */
export interface AssignmentQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface AssignmentQuestionsResponse {
  questions: AssignmentQuestion[];
}

export interface GradedSubmitRequest {
  answers: { questionId: string; optionIndex: number }[];
}

export interface GradedSubmitResponse {
  score: number;
  totalItems: number;
  correctItems: number;
}

export interface WrittenSubmitRequest {
  text: string;
}

export interface WrittenDraftRequest {
  text: string;
}

/* ─── Course Home composite ──────────────────────────────────────── */

export interface CourseInfo {
  id: string;
  title: string;
  cefrLevel: string;
  targetLanguage: string;
  schoolName?: string;
  groupName?: string;
}

export interface CourseLevelGroup {
  /** Course-version section id (a "Leksjon" grouping of sub-lesson units). */
  id: string;
  title: string;
  position: number;
  units: UnitSummary[];
}

export interface CourseHomePayload {
  courseInfo: CourseInfo;
  /** Ordered module list with status; empty if course has no published version. */
  units: UnitSummary[];
  /** Units grouped by their course-level ("Leksjon") section, in position order. */
  levels: CourseLevelGroup[];
  progress: CourseProgress;
  mastery: CourseMastery;
  srsDueCount: number;
  srsStreakDays: number;
  /** Cards reviewed so far today (for streak/limit display). */
  srsReviewedToday: number;
  /** Estimated vocabulary cards due (derived from sample in /srs/due). */
  srsVocabDue: number;
  /** Estimated exercise/grammar cards due. */
  srsExerciseDue: number;
  canDo: CanDoResponse;
  /** Overdue assignments; 0 until the assignment BFF is wired. */
  overdueAssignmentCount: number;
}
