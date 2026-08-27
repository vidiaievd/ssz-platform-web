import { z } from 'zod';

export const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const containerTypes = ['course', 'module', 'collection'] as const;
export const visibilities = ['public', 'school_private', 'shared', 'private'] as const;
export const accessTiers = [
  'assigned_only',
  'entitlement_required',
  'free_within_school',
  'public_free',
  'public_paid',
] as const;
export const levelSystems = ['cefr', 'custom', 'single'] as const;
export const gatingModes = ['open', 'sequential'] as const;

/**
 * The languages a course can be taught in, as ISO 639-1 codes.
 *
 * A closed list rather than free text (plan 52, Q9). The column has always been
 * `VARCHAR(10) NOT NULL` and every row in it is already a proper code — `nb`, and one
 * `nn` — but nothing stopped `Norwegian`, `NO` or `xx` from being typed in, and a code
 * that is only *usually* normalised cannot be matched against: the sentence-schema
 * builder picks its language packs by this value (`packsFor`), and so will anything else
 * that reasons about the language of a course.
 *
 * Bokmål and nynorsk are listed separately, as the data already has them. There is no
 * `no`: the macrolanguage would mean "one of the two", which is not something a course
 * can be.
 *
 * Display names are not translated here — `Intl.DisplayNames` renders the list in the
 * teacher's own locale, which is four locales this file would otherwise have to carry.
 */
export const languageCodes = [
  'nb',
  'nn',
  'sv',
  'da',
  'fi',
  'en',
  'de',
  'nl',
  'fr',
  'es',
  'it',
  'pt',
  'pl',
  'uk',
  'ru',
  'tr',
  'ar',
  'zh',
  'ja',
  'ko',
] as const;

export type LanguageCode = (typeof languageCodes)[number];

export const containerFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  containerType: z.enum(containerTypes),
  targetLanguage: z.enum(languageCodes),
  difficultyLevel: z.enum(difficultyLevels),
  visibility: z.enum(visibilities),
  accessTier: z.enum(accessTiers),
  // Create-time only (drives level-section scaffolding); never sent on update.
  levelSystem: z.enum(levelSystems).optional(),
  // Course-only student unlock policy; editable after creation.
  gatingMode: z.enum(gatingModes).optional(),
});

export type ContainerFormValues = z.infer<typeof containerFormSchema>;
