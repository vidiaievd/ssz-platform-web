'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { learningKeys, useCourseHome, type UnitContentsResult } from '@/features/learning';
import type { GrammarLinks } from '@/features/learning';

import { buildItemHref } from '../lib/map-reader-data';

/**
 * Reader hrefs for the grammar rules a text annotates.
 *
 * The search is limited to the Leksjon the text belongs to — the units of its
 * own course-level section. That is where a course puts the grammar a text
 * illustrates, and scanning the whole course would mean one request per unit
 * (fifty, for a ten-Leksjon course) to find the one page the reader might open.
 * A rule outside that section simply gets no link, which the card handles.
 *
 * Runs only when the text actually has grammar annotations, and reuses
 * `useUnitContents`' cache — the sidebar and a later navigation into the
 * grammar page both hit the same entries.
 */
export function useGrammarRuleLinks(
  courseId: string,
  unitId: string,
  ruleIds: string[],
): GrammarLinks {
  const courseHome = useCourseHome(courseId);

  const siblingUnitIds = useMemo(() => {
    const level = courseHome.data?.levels.find((l) => l.units.some((u) => u.id === unitId));
    return level?.units.map((u) => u.id) ?? [];
  }, [courseHome.data, unitId]);

  const wanted = useMemo(() => new Set(ruleIds), [ruleIds]);

  const results = useQueries({
    queries: siblingUnitIds.map((moduleId) => ({
      queryKey: learningKeys.unitContents(moduleId),
      queryFn: async (): Promise<UnitContentsResult> => {
        const res = await fetch(`/api/learning/units/${encodeURIComponent(moduleId)}/contents`);
        if (!res.ok) throw new Error('Failed to load unit contents');
        return res.json() as Promise<UnitContentsResult>;
      },
      staleTime: 60_000,
      enabled: wanted.size > 0,
    })),
  });

  // Keyed on the resolved hrefs rather than the query objects: `useQueries`
  // returns a fresh array every render, and a new Map each time would remount
  // nothing but would make every consumer of the context re-render.
  const entries = results
    .flatMap((result, i) => {
      const data = result.data;
      const unitIdOfResult = siblingUnitIds[i];
      if (!data || !unitIdOfResult) return [];
      const items = [...data.sections.flatMap((s) => s.items), ...data.ungroupedItems];
      return items
        .filter((item) => item.contentType === 'GRAMMAR_RULE' && wanted.has(item.contentId))
        .map((item): [string, string] => [
          item.contentId,
          buildItemHref(courseId, unitIdOfResult, item.id),
        ]);
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const signature = entries.map(([id, href]) => `${id}:${href}`).join('|');

  return useMemo(() => new Map(entries), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
}
