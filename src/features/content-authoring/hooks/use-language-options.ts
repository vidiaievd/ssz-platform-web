'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

import { languageCodes } from '../schemas/container';

export interface LanguageOption {
  code: string;
  name: string;
}

/**
 * The languages a course can be taught in, named in the teacher's own locale.
 *
 * One list, three call sites — the container form, the create-course wizard and the
 * quick-create panel all used to carry their own idea of it, and the wizard's was
 * nineteen hand-written English labels (plan 52, Q9). The codes are the closed list in
 * `schemas/container.ts`, which is what validation and the sentence-schema pack filter
 * read; the names come from `Intl.DisplayNames`, so four locales of copy stay out of the
 * message files and cannot go stale when the list grows.
 *
 * Sorted by the rendered name, so the order is alphabetical in whatever is being read.
 */
export function useLanguageOptions(): LanguageOption[] {
  const locale = useLocale();

  return useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'language' });
    return languageCodes
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);
}
