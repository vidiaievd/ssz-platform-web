// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
// Source: ssz-platform/packages/shared-kernel/src/wordbank-gapfill/index.ts
// Regenerate with `npm run kernel:sync`; verify with `npm run kernel:check`.
// ---------------------------------------------------------------------------

export type {
  BankWord,
  Coverage,
  FeedbackOrigin,
  Gap,
  GapFeedback,
  GapFillTask,
  GapKey,
  GapResult,
  InputMode,
  PairFeedback,
  Placement,
  Sentence,
  Settings,
  WordBankGapFill,
} from './model.js';
export { DEFAULT_SETTINGS } from './model.js';

export type { DocumentEnvelope, PersistedAnswers, PersistedContent } from './persistence.js';
export {
  fromPersisted,
  readContent,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
} from './persistence.js';

export type {
  ProjectedGapToken,
  ProjectedSentence,
  ProjectedTextToken,
  ProjectedToken,
  ProjectionOptions,
  StudentProjection,
} from './projection.js';
export { toStudentProjection } from './projection.js';

export type { Issue, IssueCode, IssueLevel, IssueStep } from './issues.js';
export { blockers, isReady, issues, warnings } from './issues.js';

export {
  answers,
  bank,
  core,
  coverage,
  EMPTY_FEEDBACK,
  equals,
  feedbackFor,
  gapKey,
  gaps,
  grade,
  pruneFeedback,
  tokens,
  withSentenceText,
} from './selectors.js';
