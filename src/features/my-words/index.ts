// Public API of «My words» (plan 75): words a student adds from texts.
export type { PersonalWord, PersonalWordStatus, WordLookup, WordCaptureSource } from './types';
export { WordCaptureProvider, useWordCapture } from './components/word-capture-provider';
export { SelectionCapture } from './components/selection-capture';
export { AddToMyWordsButton } from './components/add-to-my-words-button';
export { CAPTURE_PARAGRAPH_ATTR } from './lib/read-word-selection';
export { useMyWords, useUpdateMyWord, useDeleteMyWord } from './api/hooks';
