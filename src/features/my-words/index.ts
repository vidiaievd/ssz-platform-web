// Public API of «My words» (plan 75): words a student adds from texts.
export type { PersonalWord, PersonalWordStatus, WordLookup, WordCaptureSource } from './types';
export { WordCaptureProvider, useWordCapture } from './components/word-capture-provider';
export { WordContextMenu } from './components/word-context-menu';
export { AddToMyWordsButton } from './components/add-to-my-words-button';
export { CAPTURE_PARAGRAPH_ATTR } from './lib/word-at-point';
export { useMyWords, useUpdateMyWord, useDeleteMyWord } from './api/hooks';
export { MyWordsView } from './components/my-words-view';
