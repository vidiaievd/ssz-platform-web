import type { SelfCheckFeedback } from '@/lib/shared-kernel/error-correction';
import type { SelfCheckFeedback as TranslateSelfCheckFeedback } from '@/lib/shared-kernel/translate';
import type {
  PairId,
  RightId,
  StudentProjection as MatchPairsProjection,
} from '@/lib/shared-kernel/match-pairs';
import type { GapKey, StudentProjection } from '@/lib/shared-kernel/wordbank-gapfill';
import type { StudentProjection as MultipleChoiceGroupProjection } from '@/lib/shared-kernel/multiple-choice-group';
import type { StudentResult as ShortAnswerResult } from '@/lib/shared-kernel/short-answer';
import type { StudentResult as SentenceSchemaResult } from '@/lib/shared-kernel/sentence-schema';
import type { RubricSnapshot } from '@/lib/shared-kernel/writing-task';

/**
 * The exercise-engine attempt API, as this client uses it.
 *
 * Until now the reader never spoke to the engine at all: it fetched the exercise with
 * its answers and graded in the browser. That is workable while the answers sit in a
 * separate key the reader can simply not render — but `word_bank_gap_fill` keeps its
 * answers inside the sentences, so for this template the grading has to happen where
 * the answers are.
 */

export type CheckMode = 'PRACTICE' | 'GRADED';

export interface StartAttemptRequest {
  /** Language of the instructions, not of the answer. */
  language: string;
  mode?: CheckMode;
}

export interface StartAttemptResponse {
  attemptId: string;
  templateCode: string;
  targetLanguage: string;
  difficultyLevel: string;
  checkMode: CheckMode;
  /**
   * Shape depends on `templateCode`. For `word_bank_gap_fill` this is the masked
   * projection — the gapped words are already gone — and never the stored content.
   */
  exerciseContent: unknown;
  /** `null` for templates that withhold them, which is all of them in GRADED mode. */
  expectedAnswers: unknown;
  answerSchema: unknown;
  checkSettings: Record<string, unknown>;
  /**
   * What has already been handed in on this attempt, oldest first.
   *
   * Empty for a fresh attempt, and for every template but `short_answer` — it is the
   * only one that takes answers before the attempt closes, so it is the only one whose
   * open attempt is resumed rather than abandoned (plan 51 §8 Q6). Absent from an engine
   * older than that change, which is why it is optional here.
   */
  answeredQuestions?: ResumedAnswer[];
  checkedRows?: ResumedRow[];
  pickedOptions?: ResumedPick[];
}

/** One question of a `short_answer` set already handed in on the resumed attempt. */
export interface ResumedAnswer {
  questionId: string;
  text: string;
  verdict: 'pass' | 'partial' | 'fail';
}

/**
 * One sentence of a `sentence_schema` set already worked on in the resumed attempt.
 *
 * `revealed` is the one that must survive a reload: the learner was shown that sentence,
 * so it is closed and scores nothing. Reopening it would make a reload the cheapest way
 * to a full mark (plan 52 §3.3).
 */
export interface ResumedRow {
  rowId: string;
  attempts: number;
  placement: Record<string, string[]>;
  solved: boolean;
  revealed: boolean;
}

/**
 * One question of a `multiple_choice` set already picked at on the resumed attempt.
 *
 * `picks` is every option tried, in order, so the runner knows which try the question is
 * on — and that is the score, since only a hit on the first counts. `eliminated` and
 * `revealed` must survive a reload for the same reason `sentence_schema`'s reveal does:
 * a question shown its answer scores nothing, and a 50/50 already spent is not one to
 * hand out again (plan 53 §3.3).
 */
export interface ResumedPick {
  questionId: string;
  picks: string[];
  eliminated: string[];
  correct: boolean;
  closed: boolean;
  revealed: boolean;
}

/** `exerciseContent` when `templateCode` is `word_bank_gap_fill`. */
export type GapFillAttemptContent = StudentProjection;

export interface GapFillPlacement {
  gapKey: GapKey;
  word: string;
}

/**
 * `exerciseContent` when `templateCode` is `match_pairs`.
 *
 * The second template whose content cannot travel as stored: a pair is written whole,
 * so `content.pairs[].right` is the answer to `content.pairs[].left`. What arrives is
 * the projection — left halves as slots, a flat pool of right halves in which answers
 * and distractors are indistinguishable, shuffled per attempt server-side.
 */
export type MatchPairsAttemptContent = MatchPairsProjection;

/** One right half attached to one slot. */
export interface MatchPairsPlacement {
  pairId: PairId;
  rightId: RightId;
}

export interface SubmitAnswerRequest {
  submittedAnswer: unknown;
  timeSpentSeconds: number;
  locale?: string;
}

export interface SubmitAnswerResponse {
  attemptId: string;
  correct: boolean;
  score: number | null;
  requiresReview: boolean;
  feedback: { summary: string; hints?: string[]; correctAnswer?: unknown };
  /** Validator output. For gap-fill, a verdict and an explanation per gap. */
  details?: unknown;
  /**
   * What the clip said, for a listening exercise whose transcript shows after the answer.
   *
   * The hand-in is the end of the exercise, so there is nothing left to give away
   * (plan 56 §3.3).
   */
  audioTranscript?: { transcript: string; translation: string };
}

/** `details` when the template is `word_bank_gap_fill`. */
export interface GapFillSubmitDetails {
  totalGaps: number;
  correctGaps: number;
  gaps: Array<{ gapKey: GapKey; correct: boolean; explanation: string | null }>;
}

/**
 * `details` when the template is `match_pairs` — one entry per *filled* slot.
 *
 * A slot the learner left empty is absent rather than reported wrong: it is work not
 * done, which is not the same as work done badly. The explanation is already resolved
 * server-side for the half actually attached; the correct half is not in here, and
 * asking for it is the reveal endpoint's separate, recorded business.
 */
export interface MatchPairsSubmitDetails {
  totalPairs: number;
  correctPairs: number;
  pairs: Array<{ pairId: PairId; correct: boolean; explanation: string | null }>;
}

export interface MatchPairsSubmittedAnswer {
  placements: MatchPairsPlacement[];
}

/**
 * `details` when the template is `translate_*` — where each sentence ended up.
 *
 * Deliberately thin. The validator writes a great deal more per sentence (the variant
 * compared against, the diff, the rules tripped), all of it for the teacher queue and
 * all of it a way to read the answer key; the engine strips it before answering the
 * browser. Routing is what the learner is owed: this sentence matched and is done, that
 * one is with a teacher.
 */
export interface TranslateSubmitDetails {
  totalItems: number;
  passedItems: number;
  items: Array<{ itemId: string; routing: 'pass' | 'teacher' }>;
}

/**
 * One question of a `short_answer` set, handed in on its own.
 *
 * The attempt stays one attempt — progress, spaced repetition, the review queue and the
 * locks are all built on "one attempt, one submission" — and the answers arrive onto it
 * one at a time (plan 51 §3.3). Each is final: the same question is refused the second
 * time, by the domain rather than by the button.
 */
export type AnswerQuestionRequest = AnswerTextRequest | AnswerOptionRequest;

/** `short_answer`: what the student wrote. */
export interface AnswerTextRequest {
  questionId: string;
  text: string;
}

/**
 * `multiple_choice`: the option the student picked, or the request to be shown the key.
 *
 * `reveal` is «Vis svaret» — it closes the question, returns the key and spends no
 * attempt, which is why `optionId` may be null with it. Everything the pick is judged
 * against stays on the server: this request carries an id, and what comes back is
 * dosed by how the question stands (plan 53 §3.2).
 */
export interface AnswerOptionRequest {
  questionId: string;
  optionId: string | null;
  reveal?: boolean;
}

/**
 * What comes back with the verdict.
 *
 * Graded on the server and projected there too: the element labels arrive with a hit
 * flag and never the anchor phrase that matched, and the model answer only when
 * `showModel` allows it. The runner renders this; it computes nothing.
 */
export interface AnswerQuestionResponse<Result = ShortAnswerResult | MultipleChoiceResult> {
  attemptId: string;
  /** Which shape `result` came back in — the two templates hand back different verdicts. */
  templateCode?: string;
  /** Questions handed in so far, including this one. */
  answered: number;
  /** Answerable questions in the set. */
  total: number;
  result: Result;
  /** Whether this answer is on its way to a teacher, for the routing line. */
  routedForReview: boolean;
  /**
   * What the clip said, for a listening exercise whose transcript shows after the answer.
   *
   * Present only once the set is finished: one clip covers the whole set, so a transcript
   * after the first of five questions would answer the other four (plan 56 §3.3).
   */
  audioTranscript?: { transcript: string; translation: string };
}

/**
 * What one pick of a `multiple_choice` set comes back with — plan 53 §3.3, point 3.
 *
 * The optional fields are the whole contract, and the runner must not fill them in for
 * itself. `keyOptionId` and `why` arrive **only once the question is closed** — right,
 * revealed, or out of tries — because a retry and a 50/50 offered next to the answer are
 * theatre. `eliminated` is cumulative and arrives only on a wrong pick with a try left.
 */
export interface MultipleChoiceResult {
  questionId: string;
  /** The option that was judged. Empty when the question was revealed rather than picked. */
  optionId: string;
  correct: boolean;
  /** 1-based. Only a hit on attempt 1 scores. */
  attempt: number;
  attemptsLeft: number;
  closed: boolean;
  keyOptionId?: string;
  why?: string;
  optionWhy?: string;
  eliminated?: string[];
}

/**
 * `exerciseContent` when `templateCode` is `multiple_choice_group`.
 *
 * The table as the server decided the student may see it: the statements, the shared
 * columns, the passage where the author attached one — and the row order already settled.
 * Which column each statement belongs in, the author's line and the quote that proves it
 * are in the other column and arrive, if at all, with a check (plan 54 §3.2, §3.5).
 */
export type MultipleChoiceGroupAttemptContent = MultipleChoiceGroupProjection;

/**
 * What one check of the table carries up — plan 54 §3.3.
 *
 * `answers` is the whole table every time, because the unit of work is the table: a
 * check is a submission of all of it, and a re-check is another submission onto the same
 * attempt. `reveal` is «Vis fasit», the student giving up on the retry.
 *
 * Nothing else is sent. Which check this is, which rows are frozen and what was picked
 * the first time round are facts about the attempt, and the engine writes its own over
 * anything a client puts in their place — a client that stated its own attempt number
 * would be buying itself another go.
 */
export interface MultipleChoiceGroupSubmittedAnswer {
  /** `rowId → columnId`. A row left unanswered is simply absent. */
  answers: Record<string, string>;
  reveal?: boolean;
}

/**
 * One statement's outcome in a check.
 *
 * The optional fields are the contract, and the runner must not fill them in for itself.
 * `keyColumnId` arrives **only once the table is closed** — every row right, revealed, or
 * out of attempts — and only when the author left the key visible; a right column shown
 * beside a row that still has a retry left would make the retry theatre. `why` and
 * `quote` follow `showWhy`, and a row the author wrote neither for sends neither, which
 * is what makes "render no explanation block at all" the runner's easiest case.
 */
export interface MultipleChoiceGroupItemResult {
  itemId: string;
  /** The column picked; `null` when the statement was left unanswered. */
  submitted: string | null;
  correct: boolean;
  /** What was picked on the *first* check of this table, carried forward by the engine. */
  firstAnswer: string | null;
  keyColumnId?: string;
  why?: string;
  quote?: string;
}

/**
 * `details` when the template is `multiple_choice_group` — the state of the table after
 * a check, which is all the runner draws from.
 *
 * `closed` and `locked` are the two the runner may not second-guess. `closed` says no
 * further check is possible, and the engine refuses one whatever the budget says — so a
 * runner that offered «Prøv de feile igjen» after it would be offering a refusal.
 * `locked` is the cumulative set of rows the server froze under `lockCorrect`; it
 * survives a retry, which is why the runner holds it apart from the verdict.
 */
export interface MultipleChoiceGroupSubmitDetails {
  totalItems: number;
  passedItems: number;
  /** 1-based: which check of the table this was. */
  attempt: number;
  attemptsLeft: number;
  closed: boolean;
  locked: string[];
  items: MultipleChoiceGroupItemResult[];
}

/** Check one sentence of a `sentence_schema` set, or ask to be shown it. */
export interface CheckRowRequest {
  rowId: string;
  /** `fieldId → the ids stacked in it`, in the order they were placed. */
  placement: Record<string, string[]>;
  /** `Vis riktig skjema`: the sentence closes with the answer shown, and scores nothing. */
  reveal?: boolean;
}

/**
 * What comes back from a check.
 *
 * Graded on the server and projected there too: the marks arrive, and the sentence, the
 * rule and the full board only once the sentence is closed. The note under the board is
 * resolved there as well — its chain runs over the answer key, which no browser holds
 * (plan 52 §3.2).
 */
export interface CheckRowResponse {
  attemptId: string;
  /** Sentences closed — solved or revealed — including this one. */
  closed: number;
  /** Sentences in the set. */
  total: number;
  result: SentenceSchemaResult;
  /**
   * What the clip said, for a listening exercise whose transcript shows after the answer.
   *
   * Present only once the set is finished: one clip covers the whole set, so a transcript
   * after the first of five questions would answer the other four (plan 56 §3.3).
   */
  audioTranscript?: { transcript: string; translation: string };
}

export type AttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'SCORED'
  | 'ROUTED_FOR_REVIEW'
  /** A teacher read the submission and sent it back rather than scoring it. */
  | 'RETURNED'
  | 'ABANDONED';

/** What a teacher decided about one sentence, in the learner's copy of the verdict. */
export interface ReviewDecisionRecord {
  itemId: string;
  approved: boolean;
  /** Only when the teacher wrote one. */
  comment?: string;
}

/** An attempt read back after the fact — the record, not the session. */
export interface AttemptRecord {
  id: string;
  exerciseId: string;
  templateCode: string;
  status: AttemptStatus;
  checkMode: CheckMode;
  score: number | null;
  passed: boolean | null;
  answersRevealed: boolean;
  /** What the learner sent. Shape follows `templateCode`. */
  submittedAnswer: unknown;
  /** Validator output. `null` on GRADED attempts — the engine withholds it there. */
  validationDetails: unknown;
  submittedAt: string | null;
  scoredAt: string | null;
  /**
   * The teacher's word on the submission as a whole, once one has read it. For this
   * template it is the only place a wrong answer can be explained — the machine may not
   * invent a reason (plan 42, "Разбор ошибки").
   */
  reviewComment: string | null;
  /** Their verdict per sentence. Carries no answer key, only decisions and words. */
  reviewDecisions: ReviewDecisionRecord[] | null;
  reviewedAt: string | null;
  /**
   * The rubric behind the mark, for the templates a person grades out of criteria.
   *
   * Both arrive together and only once a verdict has been delivered: the criteria are
   * frozen onto the attempt when the work is queued, and their level descriptors are
   * part of the answer key until there is a mark for them to explain (plan 50 §4).
   */
  rubricMarks?: Record<string, number> | null;
  rubricSnapshot?: RubricSnapshot | null;
}

/** `submittedAnswer` when the template is `word_bank_gap_fill`. */
export interface GapFillSubmittedAnswer {
  placements: GapFillPlacement[];
}

export interface LastAttemptResponse {
  attempt: AttemptRecord | null;
}

/**
 * The unfinished work, saved on the attempt itself rather than in the browser.
 *
 * `writing_task` is the template this exists for: every other one loses a few placements
 * when a tab closes, and this one loses an evening. `draftAnswer` carries the same shape
 * a submission would (`{ text, ticked, elapsedSeconds }`), stored exactly as sent and
 * never validated — a save refused for a half-typed sentence is the failure the endpoint
 * exists to prevent.
 */
export interface SaveDraftRequest {
  draftAnswer: unknown;
}

export interface SaveDraftResponse {
  /** When the server took it. The runner shows it as «Utkast lagret». */
  savedAt: string;
}

export interface DraftResponse {
  draftAnswer: unknown;
  draftSavedAt: string | null;
}

/**
 * The status of one attempt by id — 47.0.B. Asked after a `submit` call fails, to tell
 * whether the request was lost (nothing to show for it — `IN_PROGRESS`) from whether
 * only the response was (the work is already `ROUTED_FOR_REVIEW` or `SCORED`). Nothing
 * else about the attempt travels here: a second look at the answer or the validator's
 * output is not this check's business.
 */
export interface AttemptStatusResponse {
  status: AttemptStatus;
}

/**
 * "How am I doing?", asked mid-attempt by the two templates that offer it.
 *
 * A server round-trip for the same reason grading is: the answer is derived from the
 * key, and the key never reaches the browser. What comes back is counts and mistake
 * types for `error_correction`, and — for `translate_*` — a verdict per sentence with
 * the key's own words masked out of the diff.
 */
export interface SelfCheckRequest {
  /**
   * The work so far, in the shape a submission carries: `{ items: { <id>: edits } }`
   * for `error_correction`, `{ answers: [{ itemId, text }] }` for `translate_*`.
   */
  draftAnswer: unknown;
}

/** Whose attempt it was, and what asking cost — the same for either template. */
export interface SelfCheckEnvelope {
  attemptId: string;
  /** Including the one just spent. */
  checksUsed: number;
  checksLeft: number;
}

export interface ErrorCorrectionSelfCheckResponse extends SelfCheckEnvelope, SelfCheckFeedback {
  templateCode: 'error_correction';
}

export interface TranslateSelfCheckResponse extends SelfCheckEnvelope, TranslateSelfCheckFeedback {
  templateCode: 'translate_to_target' | 'translate_from_target';
}

/**
 * Discriminated by `templateCode`, because the two payloads share nothing but their
 * `items` key and mean entirely different things by it. A runner that reads the wrong
 * half is a bug this union turns into a compile error.
 */
export type SelfCheckResponse = ErrorCorrectionSelfCheckResponse | TranslateSelfCheckResponse;

/**
 * The answers, once the learner has asked for them.
 *
 * Discriminated by `templateCode`, as the engine sends it: "the answer" is a different
 * shape per template, and a flat union of optional fields would leave every caller
 * guessing which ones are populated. `templateCode` was additive on the server — the
 * gap-fill payload is unchanged down to the field names — so narrowing on it here costs
 * the gap-fill runner nothing.
 */
export interface RevealedGapAnswer {
  gapKey: GapKey;
  label: string;
  word: string;
  why: string | null;
}

export interface RevealedSlotAnswer {
  pairId: PairId;
  /** Which pool chip belonged in this slot, so it can be shown in place. */
  rightId: RightId;
  text: string;
  why: string | null;
}

export type RevealAnswersResponse =
  | {
      attemptId: string;
      templateCode: 'word_bank_gap_fill';
      answers: RevealedGapAnswer[];
      attemptClosed: boolean;
    }
  | {
      attemptId: string;
      templateCode: 'match_pairs';
      answers: RevealedSlotAnswer[];
      attemptClosed: boolean;
    };
