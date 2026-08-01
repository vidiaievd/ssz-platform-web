/**
 * ordbokene.no serves both Norwegian standards from one site; the second path
 * segment picks the dictionary (`bm` Bokmål, `nn` Nynorsk) and the first is the
 * site's own interface language, not the entry's.
 */
const ORDBOKENE_DICTIONARY: Record<string, string> = {
  nb: 'bm',
  no: 'bm',
  nn: 'nn',
};

/**
 * A link to the authoritative dictionary entry for a word, or undefined when
 * the target language has no dictionary wired up here — the card then simply
 * shows no link rather than a guess that 404s.
 */
export function dictionaryUrl(lemma: string, targetLanguage: string): string | undefined {
  const primary = targetLanguage.toLowerCase().split(/[-_]/)[0] ?? '';
  const dictionary = ORDBOKENE_DICTIONARY[primary];
  if (!dictionary || !lemma.trim()) return undefined;
  return `https://ordbokene.no/nno/${dictionary}/${encodeURIComponent(lemma.trim())}`;
}

/** Host shown on the link itself, so the reader knows where it goes before clicking. */
export const DICTIONARY_HOST = 'ordbokene.no';
