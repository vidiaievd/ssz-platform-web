/* ─── SRS ─────────────────────────────────────────────────────────
 * Mirrors learning-service's actual DTOs — application/dto/srs.dto.ts and
 * presentation/dto/review-card.request.ts. The shapes that used to live here
 * described an API that never existed (numeric ratings, front/back the server
 * did not send, a settings endpoint with no route), so every consumer was
 * broken at runtime; see the Phase 8 notes in VoxOrd's course-integration
 * plan for the full audit.
 * ────────────────────────────────────────────────────────────────── */

export const REVIEW_RATINGS = ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const;

/** FSRS grade. A string enum server-side, not 1..4. */
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export type SrsContentType = 'EXERCISE' | 'VOCABULARY_WORD';

export type SrsCardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING' | 'SUSPENDED';

/** What each rating would schedule, computed by the server for this card. */
export interface SrsPredictedInterval {
  rating: ReviewRating;
  scheduledDays: number;
  label: string;
}

/**
 * Word content resolved server-side (ssz-platform `4127811`). Present only on
 * VOCABULARY_WORD cards from `/srs/due`, and absent when the content lookup
 * failed — which is deliberately non-fatal there — so treat both as optional.
 */
export interface SrsCardFront {
  word: string;
  partOfSpeech: string | null;
  ipaTranscription: string | null;
  audioMediaId: string | null;
  listId: string;
}

export interface SrsCardExample {
  text: string;
  translation: string | null;
  audioMediaId: string | null;
}

export interface SrsCardBack {
  translation: string | null;
  alternativeTranslations: string[];
  definition: string | null;
  usageNotes: string | null;
  translationLanguage: string | null;
  /** The translation came from a language other than the one requested. */
  fallbackUsed: boolean;
  /** No usable translation exists — show the target language only. */
  immersionMode: boolean;
  examples: SrsCardExample[];
}

export interface SrsCard {
  id: string;
  userId: string;
  contentType: SrsContentType;
  contentId: string;
  state: SrsCardState;
  /** ISO 8601. */
  dueAt: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Empty on the review response — the server fills it only on `/srs/due`. */
  predicted: SrsPredictedInterval[];
  front?: SrsCardFront | null;
  back?: SrsCardBack | null;
}

export interface SrsDueResponse {
  cards: SrsCard[];
  reviewedToday: number;
  dailyLimit: number;
  streakDays: number;
  /**
   * Added by the BFF from `/srs/stats/me` — `cards` is a bounded sample
   * (`limit`), never the true backlog, so its length must not be used here.
   */
  dueCount: number;
}

export interface ReviewRequest {
  rating: ReviewRating;
  /** ISO 8601. Defaults to server time when omitted. */
  reviewedAt?: string;
  /** Makes a replayed submission a no-op; remembered server-side for 7 days. */
  idempotencyKey?: string;
}

/** The review endpoint returns the rescheduled card itself. */
export type ReviewResponse = SrsCard;

export interface SrsStats {
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearningCount: number;
  suspendedCount: number;
  dueNowCount: number;
  reviewedTodayCount: number;
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

/**
 * Derived from `/srs/stats/me`, which is the only SRS aggregate the server
 * keeps. Retention over time and mature/young splits are NOT available —
 * learning-service stores no review log, only each card's current state.
 */
export interface ProgressSrsStats {
  dueToday: number;
  reviewedToday: number;
  totalCards: number;
  /** Cards that have graduated into the REVIEW state. */
  cardsInReview: number;
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

/* ─── Reviews & reminders composite ──────────────────────────────── */

/**
 * The only two things the SRS schedules. This mirrors `SrsContentType` in
 * learning-service exactly — it is a closed set, not an open taxonomy, and the
 * UI labels each value through i18n rather than showing the raw string.
 */
export type ReviewKind = 'exercise' | 'vocabulary_word';

/** One (course × kind) row of the due-now breakdown. */
export interface ReviewCourseBreakdown {
  courseId: string;
  courseTitle: string;
  /** Target language of the course, for the language chip. */
  language: string;
  level: string | null;
  kind: ReviewKind;
  dueCount: number;
}

/** One future review batch, grouped by course and day. */
export interface UpcomingReview {
  courseId: string;
  courseTitle: string;
  language: string;
  /** ISO day (YYYY-MM-DD) the batch comes due. */
  dueAt: string;
  count: number;
}

export interface ReviewsSummary {
  /** Every card the SRS considers due right now. */
  totalDue: number;
  /** Subset of `totalDue` that came due before today began. */
  overdueCount: number;
  byKind: Record<ReviewKind, number>;
  breakdown: ReviewCourseBreakdown[];
  /**
   * Reviews scheduled after now. learning-service's due queue only returns
   * cards due at or before now, so this is empty until it can serve a
   * look-ahead window — see the follow-up note in docs/plan/13.
   */
  upcoming: UpcomingReview[];
  /**
   * Due cards that could not be attributed to one of the student's courses
   * (shared content, a course they lost access to, or a content-service
   * hiccup). Surfaced rather than dropped so the rows always add up to
   * `totalDue`.
   */
  unattributedDue: number;
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
  /** Cards reviewed so far today (for limit display). */
  srsReviewedToday: number;
  /** Estimated vocabulary cards due (derived from sample in /srs/due). */
  srsVocabDue: number;
  /** Estimated exercise/grammar cards due. */
  srsExerciseDue: number;
  canDo: CanDoResponse;
  /** Overdue assignments; 0 until the assignment BFF is wired. */
  overdueAssignmentCount: number;
}
