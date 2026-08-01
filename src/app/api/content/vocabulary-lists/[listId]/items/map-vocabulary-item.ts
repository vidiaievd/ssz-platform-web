import type {
  VocabularyForm,
  VocabularyGender,
  VocabularyItem,
  VocabularyParadigm,
} from '@/features/content/types';

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

const GENDERS: VocabularyGender[] = ['masculine', 'feminine', 'neuter', 'common'];

/** A trimmed non-empty string, or undefined — the shape every paradigm cell wants. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * The grid view of the same inflection keys `parseForms` flattens.
 *
 * Only the flat per-inflection keys can produce it: the documented authoring
 * shape (`{ forms: [[label, value], …] }`) carries free-text labels that cannot
 * be assigned to grid cells without guessing, so those items keep the flat list
 * alone and the card falls back to rendering it.
 *
 * `plural_form` is deliberately read by two shapes — it is "Ubestemt flertall"
 * for a noun and "Flertall" for an adjective, which is why the part of speech
 * decides the shape before any key is read.
 *
 * Returns undefined when nothing but metadata (`gender`, `verb_class`) is
 * present: a table whose only filled cell is the lemma teaches nothing.
 */
function parseParadigm(
  lemma: string,
  partOfSpeech: string | null,
  properties: Record<string, unknown> | null | undefined,
): VocabularyParadigm | undefined {
  if (!properties) return undefined;

  const gender = GENDERS.find((g) => g === properties.gender);
  const hasTense = !!(properties.present_tense || properties.past_tense || properties.perfect_tense);

  // A phrase is not a part of speech with a paradigm of its own, but the seeds
  // conjugate verbal ones ("krysse fingrene"), so it follows its keys.
  const kind =
    partOfSpeech === 'noun'
      ? 'noun'
      : partOfSpeech === 'verb'
        ? 'verb'
        : partOfSpeech === 'adjective'
          ? 'adjective'
          : hasTense
            ? 'verb'
            : gender || properties.definite_singular
              ? 'noun'
              : undefined;

  switch (kind) {
    case 'noun': {
      const paradigm = {
        kind,
        gender,
        indefiniteSingular: lemma,
        definiteSingular: str(properties.definite_singular),
        indefinitePlural: str(properties.plural_form),
        definitePlural: str(properties.definite_plural),
      } as const;
      return paradigm.definiteSingular || paradigm.indefinitePlural || paradigm.definitePlural
        ? paradigm
        : undefined;
    }
    case 'verb': {
      const paradigm = {
        kind,
        verbClass: str(properties.verb_class),
        infinitive: lemma,
        present: str(properties.present_tense),
        past: str(properties.past_tense),
        perfect: str(properties.perfect_tense),
      } as const;
      return paradigm.present || paradigm.past || paradigm.perfect ? paradigm : undefined;
    }
    case 'adjective': {
      const paradigm = {
        kind,
        positive: lemma,
        neuter: str(properties.neuter_form),
        plural: str(properties.plural_form),
        comparative: str(properties.comparative),
        superlative: str(properties.superlative),
      } as const;
      return paradigm.neuter || paradigm.plural || paradigm.comparative || paradigm.superlative
        ? paradigm
        : undefined;
    }
    default:
      return undefined;
  }
}

export function toFeShape(item: BackendItemFull): VocabularyItem {
  return {
    id: item.id,
    lemma: item.word,
    partOfSpeech: item.partOfSpeech ?? undefined,
    ipa: item.ipaTranscription ?? undefined,
    audioMediaId: item.pronunciationAudioMediaId ?? undefined,
    forms: parseForms(item.grammaticalProperties),
    paradigm: parseParadigm(item.word, item.partOfSpeech, item.grammaticalProperties),
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
