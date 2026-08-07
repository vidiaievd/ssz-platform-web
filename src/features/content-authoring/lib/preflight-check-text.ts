'use client';

import { useTranslations } from 'next-intl';

import type { PreflightCheck } from '../types';

/**
 * The rule codes `Authoring.preflightRules` has copy for. Kept as data rather
 * than probed through the translator, so an added backend rule falls back to
 * its own English detail instead of rendering a raw message key.
 *
 * Mirrors the `ruleCode` literals in content-service
 * `get-preflight.handler.ts`, plus `EMPTY_VERSION`, which the BFF raises.
 */
export const KNOWN_RULE_CODES = new Set([
  'EMPTY_VERSION',
  'VIDEO_NO_SOURCE',
  'AUDIO_NO_TRACK',
  'AUDIO_NO_TRANSCRIPT',
  'MODULE_EMPTY',
  'SECTION_EMPTY',
  'DRAFT_ITEM',
  'READ_NO_TITLE',
  'MEDIA_NO_ALT',
  'LEVEL_NO_TEACHER',
  'LIVE_NO_SCHEDULE',
  'VOCAB_NO_TRANSLATION',
  'VOCAB_NO_AUDIO',
  'EXERCISE_INCOMPLETE',
  'NO_GRAMMAR',
  'EXERCISE_COUNT_LOW',
  'LOCALE_INCOMPLETE',
  // word_bank_gap_fill carries its own editorial rules, run by the same engine
  // the builder shows the author (plan 35, step 2.3). One code per exercise, not
  // per gap — the version report is not the place to list sixty missing notes.
  'GAPFILL_EX_NO_SENTENCES',
  'GAPFILL_SENT_EMPTY',
  'GAPFILL_SENT_NO_GAP',
  'GAPFILL_BANK_DUPLICATE',
  'GAPFILL_BANK_TOO_FEW',
  'GAPFILL_BANK_TOO_SMALL',
  'GAPFILL_FB_PAIRS_UNUSED',
  'GAPFILL_FB_NO_FALLBACK',
  'GAPFILL_FB_NO_WHY',
  'GAPFILL_FB_PARTIAL_COVERAGE',
]);

export interface CheckText {
  title: string;
  fixHint: string | null;
}

/**
 * next-intl types `t` against the message tree, which cannot express a key
 * built from a backend rule code. The cast lives here only.
 */
export type RuleTranslator = (key: string, values?: Record<string, string>) => string;

export function preflightCheckText(t: RuleTranslator, check: PreflightCheck): CheckText {
  if (!KNOWN_RULE_CODES.has(check.ruleCode)) {
    // An unknown rule still has content-service's own wording. Better a
    // sentence in one language than `preflightRules.NEW_RULE.title`.
    return { title: check.detail, fixHint: null };
  }

  const rule = t(`${check.ruleCode}.title`);

  return {
    title: check.itemTitle ? t('withItem', { rule, item: check.itemTitle }) : rule,
    fixHint: t(`${check.ruleCode}.fix`),
  };
}

/** Same resolution, bound to the `Authoring.preflightRules` namespace. */
export function usePreflightCheckText(): (check: PreflightCheck) => CheckText {
  const t = useTranslations('Authoring.preflightRules') as unknown as RuleTranslator;
  return (check) => preflightCheckText(t, check);
}
