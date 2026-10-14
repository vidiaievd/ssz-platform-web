/** Mirrors content-service's PersonalWordResponseDto (plan 75). */
export type PersonalWordStatus = 'pending' | 'resolved';

export interface PersonalWord {
  entryId: string;
  /** The vocabulary item — what an SRS card is keyed by. */
  vocabularyItemId: string;
  targetLanguage: string;
  /** The item's word: the dictionary form when it came from a course. */
  word: string;
  /** The form selected in the text. */
  surfaceForm: string;
  partOfSpeech: string | null;
  translation: string | null;
  status: PersonalWordStatus;
  /** False for a course word, which the student cannot edit. */
  ownWord: boolean;
  contextSentence: string | null;
  source: {
    variantId: string | null;
    paragraphIndex: number | null;
    charStart: number | null;
  } | null;
  createdAt: string;
}

export interface WordLookup {
  surfaceForm: string;
  entry: PersonalWord | null;
  /** A translation here is the one that will be used for the word. */
  catalog: { word: string; partOfSpeech: string | null; translation: string | null } | null;
}

/** Where a word was met — everything the add dialog needs besides the word itself. */
export interface WordCaptureSource {
  targetLanguage: string;
  variantId: string | null;
  paragraphIndex: number | null;
  charStart: number | null;
  contextSentence: string | null;
}

export interface CaptureWordInput {
  targetLanguage: string;
  translationLanguage: string;
  surfaceForm: string;
  translation?: string;
  contextSentence?: string;
  sourceVariantId?: string;
  sourceParagraph?: number;
  sourceCharStart?: number;
}
