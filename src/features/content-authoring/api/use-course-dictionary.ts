'use client';

import { useQuery } from '@tanstack/react-query';

import type { DictionaryEntry } from '@/lib/shared-kernel/inflection-table';

import { authoringKeys } from './keys';

/**
 * The words of the exercise's course, of one part of speech — the inflection-table picker's
 * list (plan 69 §3.8).
 *
 * Read once per paradigm and searched on the client: a course dictionary is hundreds of
 * words, not thousands. Not cached long — the author may be adding words in another tab.
 * A failure leaves the picker saying so; typing a lemma by hand still works.
 */
export function useCourseDictionary(exerciseId: string, pos: string, lang: string, enabled = true) {
  return useQuery<DictionaryEntry[]>({
    queryKey: authoringKeys.courseDictionary(exerciseId, pos, lang),
    queryFn: async () => {
      const params = new URLSearchParams({ pos, lang });
      const res = await fetch(`/api/content/exercises/${exerciseId}/dictionary?${params}`);
      if (!res.ok) throw new Error('Failed to read the course dictionary');
      return res.json() as Promise<DictionaryEntry[]>;
    },
    enabled: enabled && exerciseId !== '' && pos !== '',
    retry: false,
    staleTime: 30_000,
  });
}
