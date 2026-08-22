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

export { McqGroupBody, keepCorrectPicks, optionsOf } from './mcq-group-body';
export type {
  McqGroupBodyProps,
  McqGroupContent,
  McqGroupExpectedAnswers,
  McqGroupExpectedItem,
  McqGroupItemResult,
  McqGroupOption,
  McqGroupQuestion,
  McqGroupResults,
  McqGroupValue,
} from './mcq-group-body';

export { MatchPairsBody } from './match-pairs-body';
export type {
  MatchPairsBodyProps,
  MatchPairsValue,
  RevealedSlot,
  SlotVerdict,
} from './match-pairs-body';

export { ShortAnswerBody } from './short-answer-body';
export type {
  ShortAnswerBodyProps,
  ShortAnswerContent,
  ShortAnswerExpectedAnswers,
} from './short-answer-body';

export { WritingBody } from './writing-body';
export type { WritingBodyProps, WritingContent, WritingValue, WritingTopic } from './writing-body';

export { measure, submitGate, WritingTaskBody } from './writing-task-body';
export type {
  DraftSaveState,
  SubmitBlock,
  SubmitGate,
  WritingTaskBodyProps,
  WritingTaskPhase,
  WritingTaskValue,
} from './writing-task-body';

export { readWritingTaskProjection } from './writing-task-projection';

export { ErrorCorrectionBody } from './error-correction-body';
export type { ErrorCorrectionBodyProps, ErrorCorrectionValue } from './error-correction-body';
export { readStudentProjection } from './error-correction-projection';

export { TranslateRunnerBody } from './translate-runner-body';
export type {
  TranslateRunnerBodyProps,
  TranslateRouting,
  TranslateValue,
  TranslateItemVerdict,
  TranslateVerdicts,
} from './translate-runner-body';
export { readTranslateProjection } from './translate-projection';

export { TextOrderBody, shuffleOrder } from './text-order-body';
export type {
  TextOrderBodyProps,
  TextOrderContent,
  TextOrderExpectedAnswers,
  TextOrderResults,
  OrderLine,
} from './text-order-body';

export { WordBankFillBody, parseSentence, keepCorrectBlanks } from './word-bank-fill-body';
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
  checkMcqGroup,
  gradeFill,
  gradeFreeText,
  gradeSentenceSchema,
  checkWordBankFill,
  checkTextOrder,
} from './grading';
export type { FreeTextExpectedAnswers } from './grading';

/* The short-answer checker is shared with the authoring side, so it lives in
   lib/ — re-exported here so runner consumers keep one import path. */
export { checkShortAnswer } from '@/lib/exercises/short-answer-diff';
export type { DiffOutcome, DiffToken, ShortAnswerDiff } from '@/lib/exercises/short-answer-diff';

export {
  deriveVisualState,
  modeAccent,
  modeAccentSoft,
  PRACTICE_ACCENT,
  GRADED_ACCENT,
} from './types';
export type { RunnerMode, RunnerPhase, FeedbackDensity, RunnerVisualState } from './types';

export {
  WordBankGapFillBody,
  type GapFillValue,
  type GapVerdict,
  type WordBankGapFillBodyProps,
} from './wordbank-gapfill-body';
