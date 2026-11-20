'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchOpenDraft } from '@/features/student/exercises/api/use-attempt';
import { SchoolTaskLocked, useSchoolStatus } from '@/features/school-lifecycle';

import { readSubmitted } from './writing-task-solver';

/**
 * A `writing_task` of a course whose school is not active (plan 90, live check block 12).
 *
 * The lock as for every server-graded task, plus the draft the learner saved on an attempt opened
 * before the school stopped — read only (owner's decision). Read through the attempt list, never a
 * start: the engine takes no new attempt here. No draft, or the lookup failed → the plain lock.
 */
export function LockedWritingTask({
  exerciseId,
  line,
  bare,
}: {
  exerciseId: string;
  line?: string;
  bare?: boolean;
}) {
  const status = useSchoolStatus();
  const draft = useQuery({
    queryKey: ['exercise-open-draft', exerciseId],
    queryFn: () => fetchOpenDraft(exerciseId),
    staleTime: 30_000,
  });

  return (
    <SchoolTaskLocked
      line={line}
      bare={bare}
      draft={readSubmitted(draft.data)?.text ?? null}
      status={status === 'active' || status === undefined ? null : status}
    />
  );
}
