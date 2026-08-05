import type { VocabularyItem } from '@/features/content/types';

/** A glossary hit: the item, plus which surface form of it was matched. */
export interface GlossaryEntry {
  item: VocabularyItem;
  /** Surface form that matched. Equals `item.lemma` for the base form. */
  form: string;
  /** Label from `VocabularyForm.label`; `null` when the lemma itself matched. */
  formLabel: string | null;
}

/** Lowercased surface form → glossary entry, for the module's marked words. */
export type GlossaryIndex = Map<string, GlossaryEntry>;

/**
 * Builds the lookup index in two passes so a lemma always beats another item's
 * inflected form. Within a pass the first item in `items` order wins.
 */
export function buildGlossaryIndex(items: VocabularyItem[]): GlossaryIndex {
  const index: GlossaryIndex = new Map();

  for (const item of items) {
    const key = item.lemma.trim().toLowerCase();
    if (!key || index.has(key)) continue;
    index.set(key, { item, form: item.lemma, formLabel: null });
  }

  for (const item of items) {
    for (const form of item.forms ?? []) {
      const key = form.value?.trim().toLowerCase();
      if (!key || index.has(key)) continue;
      index.set(key, { item, form: form.value, formLabel: form.label });
    }
  }

  return index;
}

export interface GlossaryToken {
  id: number;
  text: string;
  /** Offset of the token's first character in the source `text`. */
  start: number;
  entry: GlossaryEntry | null;
}

/**
 * Splits `text` into tokens, tagging runs that match a glossary-marked lemma or
 * one of its declared forms (case-insensitive, longest-match-first).
 *
 * Boundaries are expressed as letter/mark/number lookarounds rather than `\b`,
 * whose ASCII semantics treat `æøå` as non-letters and would break matching at
 * Norwegian word edges.
 */
export function tokenizeGlossary(text: string, index: GlossaryIndex): GlossaryToken[] {
  const keys = [...index.keys()].sort((a, b) => b.length - a.length);
  if (keys.length === 0) return [{ id: 0, text, start: 0, entry: null }];

  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{M}\\p{N}])`,
    'giu',
  );

  const tokens: GlossaryToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(re)) {
    const start = match.index;
    if (start > cursor) {
      tokens.push({ id: tokens.length, text: text.slice(cursor, start), start: cursor, entry: null });
    }
    // The lookarounds are zero-width, so match[0] is exactly the captured form.
    const matched = match[0];
    tokens.push({
      id: tokens.length,
      text: matched,
      start,
      entry: index.get(matched.toLowerCase()) ?? null,
    });
    cursor = start + matched.length;
  }

  if (cursor < text.length) {
    tokens.push({ id: tokens.length, text: text.slice(cursor), start: cursor, entry: null });
  }

  return tokens.length > 0 ? tokens : [{ id: 0, text, start: 0, entry: null }];
}
