export interface BulkVocabularyRow {
  lemma: string;
  translation: string;
  partOfSpeech?: string;
}

/**
 * Parses pasted vocabulary rows, one word per line. Accepts tab-separated
 * cells (pasted from a spreadsheet) or `lemma - translation` for plain text.
 * Cell order is `lemma, translation, partOfSpeech?`. Lines missing a lemma or
 * translation are dropped.
 */
export function parseVocabularyBulkPaste(text: string): BulkVocabularyRow[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = (line.includes('\t') ? line.split('\t') : line.split(/\s+-\s+/)).map((cell) =>
        cell.trim(),
      );
      const [lemma, translation, partOfSpeech] = cells;
      return { lemma: lemma ?? '', translation: translation ?? '', partOfSpeech: partOfSpeech || undefined };
    })
    .filter((row) => !!row.lemma && !!row.translation);
}
