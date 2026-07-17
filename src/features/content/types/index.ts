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
  currentPublishedVersionId?: string | null;
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
  durationMinutes: number | null;
  xpReward: number | null;
}

export interface CurriculumTreeSectionNode {
  id: string;
  title: string;
  position: number;
  items: CurriculumTreeItemNode[];
}

export interface CurriculumTreeModuleNode {
  id: string;
  containerId: string;
  versionId: string | null;
  title: string | null;
  titleEn: string | null;
  position: number;
  isRequired: boolean;
  sections: CurriculumTreeSectionNode[];
  ungroupedItems: CurriculumTreeItemNode[];
}

export interface CurriculumTreeLevelNode {
  id: string | null;
  title: string | null;
  position: number;
  modules: CurriculumTreeModuleNode[];
}

export interface CurriculumTree {
  versionId: string;
  containerId: string;
  levelSystem: 'cefr' | 'custom' | 'single';
  levels: CurriculumTreeLevelNode[];
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

/** Ordered gap-fill/comprehension activity staged after an AUDIO lesson variant's transcript (BE1.3). */
export interface LessonListeningStage {
  exerciseId: string;
  position: number;
  stageType: ListeningStageType;
}

/** Author-marked glossary word for a TEXT/VIDEO lesson variant (BE1.5). No unmark endpoint exists. */
export interface GlossaryMark {
  id: string;
  vocabularyItemId: string;
  occurrenceCount: number;
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

export interface VocabularyItem {
  id: string;
  lemma: string;
  partOfSpeech?: string;
  ipa?: string;
  translations: VocabularyTranslation[];
  examples: VocabularyExample[];
  forms?: VocabularyForm[];
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
