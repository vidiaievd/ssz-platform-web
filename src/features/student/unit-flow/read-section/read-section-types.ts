export type ListenMode = 'read' | 'listen-text' | 'listen-only';

export interface GlossaryEntry {
  /** IPA phonetic string, e.g. '/ˈsyːkəˌplɛɪər/'. */
  ph: string;
  /** English translation. */
  tr: string;
  tag: 'noun' | 'verb' | 'adj';
}

/** Keyed by lowercase Norwegian word as it appears in the text. */
export type GlossaryMap = Record<string, GlossaryEntry>;

export interface TextParagraph {
  target: string;   // Norwegian text
  translation: string;
}
