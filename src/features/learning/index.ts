/* ─── API hooks ──────────────────────────────────────────────────── */
export { learningKeys } from './api/keys';
export { useSrsDue } from './api/use-srs-due';
export { useSrsReview } from './api/use-srs-review';
export { useSrsStats } from './api/use-srs-stats';
export { useSrsSettings, usePatchSrsSettings } from './api/use-srs-settings';
export { useCourseProgress } from './api/use-course-progress';
export { useCourseMastery } from './api/use-course-mastery';
export { useCanDo } from './api/use-can-do';
export { useCourseHome } from './api/use-course-home';
export { useUnitContents } from './api/use-unit-contents';
export { useUpsertProgress } from './api/use-upsert-progress';
export { useProgressOverview } from './api/use-progress-overview';
export { useAssignments, useAssignment, useAssignmentQuestions, useSubmitGradedAssignment, useSubmitWrittenAssignment, useSaveWrittenDraft } from './api/use-assignments';

/* ─── Types ──────────────────────────────────────────────────────── */
export type {
  CanDoItem,
  CanDoResponse,
  CourseMastery,
  CourseHomePayload,
  CourseInfo,
  CourseProgress,
  UnitStatus,
  UnitSummary,
  ExpandedExerciseRef,
  ExpandedGrammarExample,
  ExpandedGrammarRule,
  ExpandedLesson,
  ExpandedVocabItem,
  LessonProgress,
  LessonProgressStatus,
  ModuleProgress,
  ReviewRating,
  ReviewRequest,
  ReviewResponse,
  SkillMastery,
  SrsCard,
  SrsCardBack,
  SrsCardDirection,
  SrsCardFront,
  SrsCardPredicted,
  SrsCardSentence,
  SrsCardStatus,
  SrsDueResponse,
  SrsHeatmapDay,
  SrsSettings,
  SrsStats,
  UnitContentsItem,
  UnitContentsItemStatus,
  UnitContentsResult,
  UnitContentsSection,
  ProgressCanDo,
  ProgressCanDoState,
  ProgressModule,
  ProgressModuleStatus,
  ProgressOverview,
  ProgressSkillId,
  ProgressSkillMastery,
  ProgressSrsStats,
  ProgressStudentInfo,
  AssignmentMode,
  AssignmentStatus,
  Assignment,
  AssignmentListResponse,
  GradedSubmitRequest,
  GradedSubmitResponse,
  WrittenSubmitRequest,
  WrittenDraftRequest,
  AssignmentQuestion,
  AssignmentQuestionsResponse,
  UpsertProgressRequest,
  ProgressRecord,
} from './types';

/* ─── Session store ──────────────────────────────────────────────── */
export { useSrsSessionStore } from './stores/srs-session-store';
export type { SrsPhase, CardState, RatingError } from './stores/srs-session-store';

/* ─── Components ─────────────────────────────────────────────────── */
export { AudioPlayer } from './components/audio-player';
export type { AudioPlayerProps } from './components/audio-player';

export { BottomBar } from './components/bottom-bar';
export type { BottomBarProps } from './components/bottom-bar';

export { CanDoBadge } from './components/can-do-badge';
export type { CanDoBadgeProps, CanDoState } from './components/can-do-badge';

export { EmptyState } from './components/empty-state';
export type { EmptyStateProps } from './components/empty-state';

export { ErrorState } from './components/error-state';
export type { ErrorStateProps } from './components/error-state';

export { GlossaryPopover } from './components/glossary-popover';
export type { GlossaryPopoverProps, PartOfSpeech } from './components/glossary-popover';

export { GlossaryParagraph } from './components/glossary-paragraph';
export type { GlossaryParagraphProps } from './components/glossary-paragraph';

export { buildGlossaryIndex, tokenizeGlossary } from './lib/tokenize-glossary';
export type { GlossaryIndex, GlossaryToken } from './lib/tokenize-glossary';

export { formatTimecode } from './lib/format-timecode';

export { VideoPlayer } from './components/video-player';
export type { VideoPlayerProps, VideoPlayerHandle } from './components/video-player';

export { LearningSkeleton } from './components/learning-skeleton';
export type { LearningSkeletonProps } from './components/learning-skeleton';

export { MasteryBar } from './components/mastery-bar';
export type { MasteryBarProps } from './components/mastery-bar';

export { ProgressBadge } from './components/progress-badge';
export type { ProgressBadgeProps } from './components/progress-badge';

export { RefStrip } from './components/ref-strip';
export type { RefStripParagraph, RefStripProps } from './components/ref-strip';

export { UnitStepper } from './components/unit-stepper';
export type { UnitPhase, UnitStepperProps } from './components/unit-stepper';

/* ─── SRS components ─────────────────────────────────────────────── */
export { SrsPage } from './components/srs/srs-page';
export { SrsEntry } from './components/srs/entry';
export { SrsSession } from './components/srs/session';
export { SessionSummary } from './components/srs/summary';
export { StreakChip } from './components/srs/streak-chip';
export { PosChip } from './components/srs/pos-chip';
export { AudioButton } from './components/srs/audio-button';
export { RatingBar } from './components/srs/rating-bar';
export { ReviewCard } from './components/srs/review-card';
export { LimitReachedBanner } from './components/srs/limit-banner';
export { SessionProgress } from './components/srs/session-progress';
export { RetryBar } from './components/srs/retry-bar';
export { SrsSettingsDialog } from './components/srs/settings-dialog';
export { SrsStatsPage } from './components/srs/srs-stats-page';
export { Heatmap } from './components/srs/heatmap';
