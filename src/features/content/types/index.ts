export type AccessTier =
  | 'assigned_only'
  | 'entitlement_required'
  | 'free_within_school'
  | 'public_free'
  | 'public_paid';
export type ContainerType = 'course' | 'module' | 'collection';
export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Visibility = 'public' | 'school_private' | 'shared' | 'private';
export type ContentItemType = 'LESSON' | 'VOCABULARY_LIST' | 'GRAMMAR_RULE' | 'EXERCISE';

export interface Container {
  id: string;
  slug: string | null;
  title: string;
  description?: string | null;
  containerType: ContainerType;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  accessTier: AccessTier;
  /** Create-time only; drives level-section scaffolding. Not editable after creation. */
  levelSystem?: 'cefr' | 'custom' | 'single';
  /** Course-only: how sub-lessons unlock for students. Defaults to 'open'. */
  gatingMode?: 'open' | 'sequential';
  currentPublishedVersionId?: string | null;
  /**
   * Composition state of this container's draft against its live version.
   * Present only where the BFF resolves it (the author's own container list);
   * `currentPublishedVersionId` alone cannot express "live, with changes
   * students cannot see yet".
   */
  publishState?: ContainerPublishState;
  /**
   * Modules inside this container that students cannot open — never published,
   * or holding changes that are not live. Modules are versioned independently
   * of their course, so an up-to-date course can still hold several.
   */
  pendingModuleCount?: number;
  ownerUserId: string;
  ownerSchoolId?: string | null;
  ownerName?: string;
  coverImageMediaId?: string | null;
  lessonCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerItem {
  id: string;
  containerVersionId: string;
  position: number;
  itemType: 'container' | 'lesson' | 'vocabulary_list' | 'grammar_rule' | 'exercise';
  itemId: string;
  isRequired: boolean;
  sectionId?: string | null;
  /** @deprecated free-text fallback — prefer sectionId */
  sectionLabel?: string | null;
  /** Display title of the referenced content, resolved server-side. */
  title: string | null;
  addedAt: string;
}

export interface ContainerSection {
  id: string;
  containerVersionId: string;
  title: string;
  position: number;
  createdAt: string;
}

/**
 * Editable curriculum tree for a course version (levels → modules → sections
 * → items), served by content-service `GET /containers/:id/versions/:versionId/tree`
 * (plan 30 FE1.1 / plan 29 BE2.2). Field names mirror `CurriculumTree*ResponseDto`.
 */
export interface CurriculumTreeItemNode {
  id: string;
  itemType: 'container' | 'lesson' | 'vocabulary_list' | 'grammar_rule' | 'exercise';
  refId: string;
  title: string | null;
  position: number;
  isRequired: boolean;
  lessonKind: 'text' | 'video' | 'audio' | 'live' | null;
  state: 'draft' | 'published' | null;
  /**
   * Whether the owning container's *currently published* version places this
   * item — that is, whether a student can open it right now. `null` when that
   * container has never been published, which its own badge already says.
   *
   * Not the same question as `state`: a lesson saved through the editor is
   * variant-published immediately, while the row placing it lives in a draft
   * version students cannot see.
   */
  isLive: boolean | null;
  durationMinutes: number | null;
  xpReward: number | null;
}

export interface CurriculumTreeSectionNode {
  id: string;
  title: string;
  position: number;
  items: CurriculumTreeItemNode[];
}

/**
 * Publish state of a container as content-service reports it.
 *
 * `pending_changes` means the container is live but its draft version holds a
 * different set of items — those additions/removals/moves are invisible to
 * students until it is published again. Edits to an item's own content are not
 * tracked here: they rewrite a shared row and reach students immediately.
 */
export type ContainerPublishState = 'draft' | 'published' | 'pending_changes';

export interface CurriculumTreeModuleNode {
  id: string;
  containerId: string;
  versionId: string | null;
  title: string | null;
  titleEn: string | null;
  position: number;
  isRequired: boolean;
  publishState: ContainerPublishState;
  sections: CurriculumTreeSectionNode[];
  ungroupedItems: CurriculumTreeItemNode[];
}

export interface CurriculumTreeLevelNode {
  id: string | null;
  title: string | null;
  position: number;
  modules: CurriculumTreeModuleNode[];
  /**
   * Leaf items in this section of the container being edited. A course keeps
   * modules here; a module keeps its own lessons, vocabulary and exercises —
   * and both are edited through the same screen.
   */
  items: CurriculumTreeItemNode[];
}

export interface CurriculumTree {
  versionId: string;
  containerId: string;
  containerType: ContainerType;
  levelSystem: 'cefr' | 'custom' | 'single';
  publishState: ContainerPublishState;
  levels: CurriculumTreeLevelNode[];
  /** The edited container's own items that belong to no section. */
  ungroupedItems: CurriculumTreeItemNode[];
}

export interface PageInfo {
  nextCursor?: string;
  hasNextPage: boolean;
  total?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface LessonVariant {
  id: string;
  lessonId: string;
  explanationLanguage: string;
  minLevel: DifficultyLevel;
  maxLevel: DifficultyLevel;
  displayTitle: string;
  displayDescription?: string | null;
  bodyMarkdown: string;
  estimatedReadingMinutes?: number | null;
  status: 'draft' | 'published';
  /** Full transcript of the listening track. AUDIO-kind lessons only (BE1.3). */
  transcript?: string | null;
}

/** Paragraph-aligned bilingual translation for TEXT lesson variants (BE1.4). */
export interface LessonParagraph {
  target: string;
  translation: string | null;
}

/** Ordered transcript cue for a VIDEO lesson variant (BE1.2). */
export interface LessonVideoCue {
  position: number;
  startSeconds: number;
  targetLine: string;
  translationLine: string | null;
}

/** Comprehension-check exercise linked to a VIDEO lesson variant (BE1.2). At most one per variant. */
export interface LessonVideoQuestion {
  exerciseId: string;
}

export type ListeningStageType = 'gap_fill' | 'comprehension';

/**
 * Ordered gap-fill/comprehension activity staged after a lesson variant's primary
 * content (BE1.3): an AUDIO transcript, or a TEXT body's post-reading check
 * (spec 17). Named for the surface it was introduced on — see spec 17 §2.1.
 */
export interface LessonListeningStage {
  exerciseId: string;
  position: number;
  stageType: ListeningStageType;
}

/**
 * Author-marked glossary word for a TEXT/VIDEO lesson variant (BE1.5).
 * Position-free — see `LessonTextSpan` for the positional model added in phase D.
 */
export interface GlossaryMark {
  id: string;
  vocabularyItemId: string;
  occurrenceCount: number;
}

export type LessonSpanKind = 'vocab' | 'grammar' | 'chunk';

/** Why a span no longer holds: the body moved under it, or its referent is gone. */
export type LessonSpanBrokenReason = 'offset' | 'ref';

/** Where a broken span's snapshot text occurs in the current body (spec 16 §4.4). */
export interface LessonSpanAnchorCandidate {
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
}

/**
 * Positional author annotation over a TEXT lesson variant's body (spec 16).
 *
 * `charStart`/`charEnd` are a half-open UTF-16 range into the **raw markdown**
 * of paragraph `paragraphIndex`, as split by the backend's blank-line paragraph
 * splitter — the same numbering that keys `LessonParagraph`. They are *not*
 * offsets into the rendered text; projecting them onto what the reader displays
 * is the renderer's job.
 *
 * `broken` is computed by the server on every read and never stored. Broken
 * spans reach authoring surfaces (`includeBroken=true`) so the author can
 * re-anchor them, and are withheld from the reader entirely.
 */
export interface LessonTextSpan {
  id: string;
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
  kind: LessonSpanKind;
  /** Vocabulary item id for `vocab`, grammar rule id for `grammar`, null for `chunk`. */
  refId: string | null;
  /** The text the author selected, as it read at that moment. */
  textSnapshot: string;
  note: string | null;
  broken: boolean;
  brokenReason: LessonSpanBrokenReason | null;
  /** Always empty unless `broken`; a one-click repair is only safe when there is exactly one. */
  reanchorCandidates: LessonSpanAnchorCandidate[];
}

export type LessonKind = 'text' | 'video' | 'audio' | 'live';

export interface Lesson {
  id: string;
  slug: string | null;
  title: string;
  description?: string | null;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  ownerUserId: string;
  kind: LessonKind;
  /** LIVE-kind only (BE1.6). ISO 8601 datetime. */
  liveStartsAt: string | null;
  /** LIVE-kind only (BE1.6). */
  liveDurationMinutes: number | null;
  /** LIVE-kind only (BE1.6). */
  liveJoinUrl: string | null;
  /** LIVE-kind only (BE1.6). */
  liveCapacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyTranslation {
  languageCode: string;
  translation: string;
  /** Target-language dictionary-style explanation, shown to B2+ readers instead of `translation` (FE5.1). */
  definition?: string;
}

export interface VocabularyExample {
  id: string;
  template: string;
  substitution?: string;
  translations?: Record<string, string>;
}

/** One inflected form (e.g. `['Bestemt entall', 'sykepleieren']`), author-entered per item (FE5.1 "Alle former"). */
export interface VocabularyForm {
  label: string;
  value: string;
}

export type VocabularyGender = 'masculine' | 'feminine' | 'neuter' | 'common';

/**
 * The inflection paradigm as a *grid*, not a list: a noun's four cells, a verb's
 * four tenses, an adjective's degrees. `forms` carries the same values as a flat
 * label/value list — the two coexist because they answer different questions.
 * `forms` is what the tokenizer matches surface forms against and what the
 * "Alle former" drawer lists; `paradigm` is what a bøyning table can lay out in
 * rows and columns, which a flat list cannot do without parsing its labels back.
 *
 * The first cell of every paradigm is the lemma itself, which is why each shape
 * carries it under its own grammatical name rather than relying on the caller.
 */
export interface NounParadigm {
  kind: 'noun';
  gender?: VocabularyGender;
  /** The lemma — "bil". The article (en/ei/et) is derived from `gender` at render time. */
  indefiniteSingular: string;
  definiteSingular?: string;
  indefinitePlural?: string;
  definitePlural?: string;
}

export interface VerbParadigm {
  kind: 'verb';
  verbClass?: string;
  /** The lemma — "søke", without the "å" marker. */
  infinitive: string;
  present?: string;
  past?: string;
  /** Bare participle ("søkt"); the "har" auxiliary is a rendering concern. */
  perfect?: string;
}

export interface AdjectiveParadigm {
  kind: 'adjective';
  /** The lemma — "erfaren". */
  positive: string;
  neuter?: string;
  plural?: string;
  comparative?: string;
  superlative?: string;
}

export type VocabularyParadigm = NounParadigm | VerbParadigm | AdjectiveParadigm;

export interface VocabularyItem {
  id: string;
  lemma: string;
  partOfSpeech?: string;
  ipa?: string;
  translations: VocabularyTranslation[];
  examples: VocabularyExample[];
  forms?: VocabularyForm[];
  /** Grid-shaped view of `forms`, when the item's inflections fit a known paradigm. */
  paradigm?: VocabularyParadigm;
  /** Media asset id for the pronunciation clip; resolve via `useMediaAsset` (FE5.1). */
  audioMediaId?: string;
}

export interface VocabularyList {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  targetLanguage: string;
  itemCount?: number;
  createdAt: string;
}

export interface GrammarExplanation {
  id: string;
  languageCode: string;
  title: string;
  /** One-sentence gist, authored alongside the body. What a card shows instead of the body. */
  summary?: string | null;
  body: string;
  examples?: string[];
  isPublished: boolean;
}

/** One sentence in a "correct vs incorrect usage" compare-list attached to a grammar explanation. */
export interface GrammarCompareExample {
  id: string;
  sentence: string;
  note?: string | null;
  isCorrect: boolean;
}

/** Single multiple-choice comprehension check attached to a grammar explanation. */
export interface GrammarQuickCheck {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

/**
 * Richer shape of a grammar explanation for the student-facing reader (FE5.5), extending the
 * authoring/legacy `GrammarExplanation` shape with the anchor/compare/quick-check fields the
 * backend now returns.
 */
export interface GrammarExplanationDetail extends GrammarExplanation {
  anchorText?: string | null;
  anchorHighlights: string[];
  anchorNote?: string | null;
  compareExamples: GrammarCompareExample[];
  quickCheck: GrammarQuickCheck | null;
}

export interface GrammarRule {
  id: string;
  title: string;
  targetLanguage: string;
  createdAt: string;
  /** The underlying container-item id — needed to assign/reorder/remove this rule within a course. */
  containerItemId: string;
  sectionId?: string | null;
}

/** One template code from content-service's seeded exercise templates. */
export type ExerciseTemplateCode =
  | 'multiple_choice'
  | 'fill_in_blank'
  | 'translate_to_target'
  | 'translate_from_target'
  | 'match_pairs';

/** A per-language instruction/hint attached to an exercise (backend sub-resource). */
export interface ExerciseInstruction {
  id: string;
  exerciseId: string;
  instructionLanguage: string;
  instructionText: string;
  hintText: string | null;
}

/**
 * Exercise as returned by `GET /exercises/:id/display` — content only, answers
 * omitted (safe for the reader). `instructions` is the per-language sub-resource
 * list, not a plain string.
 */
export interface ExerciseDisplay {
  id: string;
  exerciseTemplateId?: string;
  templateCode: string;
  targetLanguage: string;
  difficultyLevel?: DifficultyLevel;
  content: Record<string, unknown>;
  instructions?: ExerciseInstruction[] | null;
}

/** Exercise as returned by `GET /exercises/:id/answers` — adds `expectedAnswers` for authoring. */
export interface ExerciseWithAnswers extends ExerciseDisplay {
  expectedAnswers: Record<string, unknown>;
}

/** Exercise template metadata from `GET /exercise-templates`. */
export interface ExerciseTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  contentSchema: Record<string, unknown>;
  answerSchema: Record<string, unknown>;
  defaultCheckSettings: Record<string, unknown> | null;
  supportedLanguages: string[] | null;
  isActive: boolean;
}

export type ShareRole = 'co_author' | 'viewer';

export interface ContainerShare {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  // The backend only stores sharedWithUserId — email is unrecoverable after the
  // fact (profile-service's batch lookup returns displayName, not email).
  userEmail?: string;
  userName?: string;
  role: ShareRole;
  createdAt: string;
}

export interface ContentTag {
  id: string;
  name: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface ContainerVersion {
  id: string;
  containerId: string;
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  publishedAt?: string;
  createdAt: string;
}
