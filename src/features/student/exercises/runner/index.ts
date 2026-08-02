export { ExerciseRunner } from './exercise-runner';
export type { ExerciseRunnerProps } from './exercise-runner';

export { useRunnerState } from './use-runner-state';

export { SetProgress } from './set-progress';
export { ExTopBar } from './ex-top-bar';
export { PrimaryFooter } from './primary-footer';
export { FeedbackBar } from './feedback-bar';
export { RunnerLoadingBody } from './loading-body';
export { RunnerErrorBody } from './error-body';

export { Instr } from './instr';

export { FillBody } from './fill-body';
export type {
  FillBodyProps,
  FillContent,
  FillExpectedAnswers,
  FillRationale,
  RationaleOption,
  RationaleVerdict,
} from './fill-body';

export { AnswerNoteMarker, buildAnswerNote } from './answer-note';
export type { AnswerNote, Rationale, WordNotes } from './answer-note';


export { McqBody } from './mcq-body';
export type { McqBodyProps, McqContent, McqExpectedAnswers } from './mcq-body';

export { TranslateBody } from './translate-body';
export type { TranslateBodyProps, TranslateContent } from './translate-body';

export { MatchBody } from './match-body';
export type { MatchBodyProps, MatchContent, MatchPair } from './match-body';

export { ShortAnswerBody } from './short-answer-body';
export type {
  ShortAnswerBodyProps,
  ShortAnswerContent,
  ShortAnswerExpectedAnswers,
} from './short-answer-body';

export { WritingBody } from './writing-body';
export type { WritingBodyProps, WritingContent, WritingValue, WritingTopic } from './writing-body';

export { ErrorCorrectionBody } from './error-correction-body';
export type {
  ErrorCorrectionBodyProps,
  ErrorCorrectionContent,
  ErrorCorrectionExpected,
  ErrorCorrectionResults,
  ErrorCorrectionValue,
  ErrorChunk,
  ErrorSentence,
  ChunkOutcome,
  ChunkResult,
} from './error-correction-body';

export { TextOrderBody, shuffleOrder } from './text-order-body';
export type {
  TextOrderBodyProps,
  TextOrderContent,
  TextOrderExpectedAnswers,
  TextOrderResults,
  OrderLine,
} from './text-order-body';

export {
  WordBankFillBody,
  parseSentence,
  keepCorrectBlanks,
} from './word-bank-fill-body';
export type {
  WordBankFillBodyProps,
  WordBankFillContent,
  WordBankFillExpectedAnswers,
  WordBankFillExpectedBlank,
  WordBankBlankResult,
  WordBankFillResults,
  WordBankFillValue,
  WordBankSentence,
} from './word-bank-fill-body';

export { SentenceSchemaBody } from './sentence-schema-body';
export type {
  SentenceSchemaBodyProps,
  SentenceSchemaContent,
  SentenceSchemaExpectedAnswers,
  SchemaField,
  SchemaToken,
  SchemaPlacements,
} from './sentence-schema-body';

export {
  normAnswer,
  gradeMcq,
  gradeFill,
  gradeTranslate,
  gradeMatch,
  gradeShortAnswer,
  gradeSentenceSchema,
  checkWordBankFill,
  checkTextOrder,
  checkErrorCorrection,
} from './grading';
export type { TranslateExpectedAnswers } from './grading';

export {
  deriveVisualState,
  modeAccent,
  modeAccentSoft,
  PRACTICE_ACCENT,
  GRADED_ACCENT,
} from './types';
export type {
  RunnerMode,
  RunnerPhase,
  FeedbackDensity,
  RunnerVisualState,
} from './types';
