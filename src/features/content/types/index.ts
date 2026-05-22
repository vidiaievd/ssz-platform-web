export type AccessTier = 'PUBLIC' | 'FREE_WITHIN_SCHOOL' | 'PAID' | 'INVITE_ONLY';
export type ContainerType = 'COURSE' | 'MODULE' | 'COLLECTION';
export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ContentItemType = 'LESSON' | 'VOCABULARY_LIST' | 'GRAMMAR_RULE' | 'EXERCISE';

export interface Container {
  id: string;
  slug: string;
  title: string;
  description?: string;
  type: ContainerType;
  targetLanguage: string;
  instructionLanguage?: string;
  level?: DifficultyLevel;
  accessTier: AccessTier;
  isPublished: boolean;
  ownerId: string;
  ownerName?: string;
  coverImageUrl?: string;
  publishedVersionId?: string;
  lessonCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerItem {
  id: string;
  position: number;
  contentType: ContentItemType;
  contentId: string;
  title?: string;
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
  targetLanguage: string;
  instructionLanguage?: string;
  title: string;
  body: string;
  isPublished: boolean;
  publishedAt?: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  description?: string;
  targetLanguage: string;
  level?: DifficultyLevel;
  isPublished: boolean;
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
