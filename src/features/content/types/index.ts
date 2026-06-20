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
  sectionLabel?: string | null;
  /** Display title of the referenced content, resolved server-side. */
  title: string | null;
  addedAt: string;
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
}

export interface Lesson {
  id: string;
  slug: string | null;
  title: string;
  description?: string | null;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyTranslation {
  languageCode: string;
  translation: string;
}

export interface VocabularyExample {
  id: string;
  template: string;
  substitution?: string;
  translations?: Record<string, string>;
}

export interface VocabularyItem {
  id: string;
  lemma: string;
  partOfSpeech?: string;
  ipa?: string;
  translations: VocabularyTranslation[];
  examples: VocabularyExample[];
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

export interface GrammarRule {
  id: string;
  title: string;
  targetLanguage: string;
  createdAt: string;
}

export interface ExerciseDisplay {
  id: string;
  templateCode: string;
  targetLanguage: string;
  difficultyLevel?: DifficultyLevel;
  content: Record<string, unknown>;
  instructions?: string;
}

export type ShareRole = 'co_author' | 'viewer';

export interface ContainerShare {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string;
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
