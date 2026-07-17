import type { VocabularyItem } from '@/features/content/types';

/** Lemma (lowercased) → vocabulary item, for the module's glossary-marked words. */
export type GlossaryIndex = Map<string, VocabularyItem>;

export function buildGlossaryIndex(items: VocabularyItem[]): GlossaryIndex {
  const index: GlossaryIndex = new Map();
  for (const item of items) {
    index.set(item.lemma.toLowerCase(), item);
  }
  return index;
}

export interface GlossaryToken {
  id: number;
  text: string;
  item: VocabularyItem | null;
}

/**
 * Splits `text` into tokens, tagging runs that exactly match a glossary-marked
 * lemma (case-insensitive, longest-match-first). Matching is lemma-only — the
 * backend stores no span/position for a glossary mark (BE1.5), so inflected
 * forms in running text aren't recognized.
 */
export function tokenizeGlossary(text: string, index: GlossaryIndex): GlossaryToken[] {
  const lemmas = [...index.keys()].sort((a, b) => b.length - a.length);
  if (lemmas.length === 0) return [{ id: 0, text, item: null }];

  const escaped = lemmas.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');

  return text.split(re).map((part, id) => ({
    id,
    text: part,
    item: index.get(part.toLowerCase()) ?? null,
  }));
}
