'use client';

import { useQuery } from '@tanstack/react-query';

import { reviewKeys } from './keys';

/** One rule atom of the submission's course, as the picker lists it. */
export interface CourseGrammarAtom {
  atomId: string;
  ruleId: string;
  /** The rule's title in the reader's language, else the rule's own. */
  ruleTitle: string;
  /** As the author wrote it — atoms carry no translations. */
  title: string;
  description: string | null;
}

/**
 * The rules the reviewer may mark on a submission (plan 85, step 9).
 *
 * Fetched only once the picker is opened: most verdicts name no rule, and the catalogue is
 * read from content-service. A catalogue changes with a publish, not within a marking
 * session, so it is kept for the length of one.
 */
export function useGrammarAtoms(school: string, id: string, language: string, enabled: boolean) {
  return useQuery<CourseGrammarAtom[]>({
    queryKey: reviewKeys.grammarAtoms(school, id, language),
    queryFn: async () => {
      const response = await fetch(
        `/api/review/submissions/${id}/grammar-atoms?school=${encodeURIComponent(school)}&language=${encodeURIComponent(language)}`,
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { atoms: CourseGrammarAtom[] };
      return body.atoms;
    },
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
