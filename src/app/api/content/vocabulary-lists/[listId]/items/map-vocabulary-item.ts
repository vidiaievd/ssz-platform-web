import type { VocabularyForm, VocabularyItem } from '@/features/content/types';

export interface BackendItemSummary {
  id: string;
  word: string;
  partOfSpeech: string | null;
  ipaTranscription: string | null;
}

export interface BackendItemFull extends BackendItemSummary {
  pronunciationAudioMediaId?: string | null;
  grammaticalProperties?: Record<string, unknown> | null;
  translations: { language: string; primaryTranslation: string; definition?: string | null }[];
  usageExamples: { id: string; exampleText: string }[];
}

/**
 * `grammaticalProperties` is an unvalidated JSON blob (content-service schema
 * comment: "validated in application code, not DB"). No authoring UI writes
 * inflection data yet, so we only recognize the documented reader shape —
 * `{ forms: [[label, value], ...] }` — and drop anything else silently.
 */
function parseForms(properties: Record<string, unknown> | null | undefined): VocabularyForm[] | undefined {
  const raw = properties?.forms;
  if (!Array.isArray(raw)) return undefined;
  const forms = raw
    .filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2)
    .map(([label, value]) => ({ label: String(label), value: String(value) }));
  return forms.length > 0 ? forms : undefined;
}

export function toFeShape(item: BackendItemFull): VocabularyItem {
  return {
    id: item.id,
    lemma: item.word,
    partOfSpeech: item.partOfSpeech ?? undefined,
    ipa: item.ipaTranscription ?? undefined,
    audioMediaId: item.pronunciationAudioMediaId ?? undefined,
    forms: parseForms(item.grammaticalProperties),
    translations: item.translations.map((t) => ({
      languageCode: t.language,
      translation: t.primaryTranslation,
      definition: t.definition ?? undefined,
    })),
    examples: item.usageExamples.map((e) => ({
      id: e.id,
      template: e.exampleText,
      substitution: '',
    })),
  };
}
