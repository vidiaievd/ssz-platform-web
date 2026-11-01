'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import type { Entitlements } from '@/features/entitlements';
import type { AiPrecheckSettings } from '@/features/school/types/ai-precheck';

/** The feature key a school's plan needs before its learners rehearse with a model. */
const FEATURE = 'ai.practice';

interface EnrollmentRow {
  containerId?: string;
  schoolId?: string | null;
  status?: string;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as T | null;
}

/** The school the learner reads this course through; none for a self-study course. */
async function schoolOf(courseId: string): Promise<string | null> {
  const rows = await getJson<EnrollmentRow[]>('/api/enrollment');
  if (!Array.isArray(rows)) return null;
  const row = rows.find(
    (r) =>
      r.containerId === courseId &&
      typeof r.schoolId === 'string' &&
      r.schoolId !== '' &&
      (r.status ?? '').toUpperCase() === 'ACTIVE',
  );
  return row?.schoolId ?? null;
}

/**
 * Whether «Check» with a model is drawn for the exercises of the course on screen (platform
 * plan 84, web step 8).
 *
 * The rehearsal is a school's: the school pays, and it has to have switched it on
 * (`GET schools/:id/ai-precheck`) and have `ai.practice` in its plan. Which school is the
 * learner's enrolment in the course — read from the route, since the solvers know only their
 * exercise; a page outside a course (a redo from «My work») has no course and draws nothing.
 * This only hides a button: the engine checks the same things and refuses with 403 (or answers
 * `refused`), so a wrong guess here lets nothing in.
 */
export function usePrecheckAvailability(): boolean {
  const params = useParams<{ courseId?: string }>();
  const courseId = typeof params?.courseId === 'string' ? params.courseId : null;

  const { data } = useQuery<boolean>({
    queryKey: ['precheck-availability', courseId],
    enabled: courseId !== null,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const schoolId = await schoolOf(courseId as string);
      if (schoolId === null) return false;
      const [setting, rights] = await Promise.all([
        getJson<AiPrecheckSettings>(`/api/schools/${schoolId}/ai-precheck`),
        getJson<Entitlements>(`/api/subscriptions/me?workspaceId=${schoolId}`),
      ]);
      return setting?.enabled === true && rights?.features[FEATURE]?.enabled === true;
    },
  });
  return data === true;
}
