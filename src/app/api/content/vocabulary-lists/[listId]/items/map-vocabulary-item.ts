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
 * Inflection keys the course seeds actually write, in the order a Norwegian
 * dictionary lists them (singular → plural for nouns, positive → plural for
 * adjectives, present → past → perfect for verbs).
 *
 * Labels stay in Norwegian on purpose: they are the target language's own
 * grammar terms, shown to a learner of Norwegian alongside the forms
 * themselves, not UI chrome. Keys carrying metadata rather than a surface form
 * (`gender`, `verb_class`) are deliberately absent.
 */
const INFLECTION_LABELS: [key: string, label: string][] = [
  ['definite_singular', 'Bestemt entall'],
  ['neuter_form', 'Intetkjønn'],
  ['plural_form', 'Ubestemt flertall'],
  ['definite_plural', 'Bestemt flertall'],
  ['present_tense', 'Presens'],
  ['past_tense', 'Preteritum'],
  ['perfect_tense', 'Perfektum'],
];

/**
 * `grammaticalProperties` is an unvalidated JSON blob (content-service schema
 * comment: "validated in application code, not DB"). Two shapes exist in the
 * wild: the documented authoring shape `{ forms: [[label, value], ...] }`, and
 * the flat per-inflection keys the course seeds write. Both are recognized;
 * anything else is dropped silently.
 */
function parseForms(properties: Record<string, unknown> | null | undefined): VocabularyForm[] | undefined {
  if (!properties) return undefined;

  const raw = properties.forms;
  if (Array.isArray(raw)) {
    const forms = raw
      .filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2)
      .map(([label, value]) => ({ label: String(label), value: String(value) }));
    if (forms.length > 0) return forms;
  }

  const forms: VocabularyForm[] = [];
  for (const [key, label] of INFLECTION_LABELS) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) {
      forms.push({ label, value: value.trim() });
    }
  }
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
