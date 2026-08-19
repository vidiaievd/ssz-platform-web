'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { CircleSlash, Clock, FileQuestion, Lock, ShieldAlert, UserCheck } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useReviewLock, useSubmission, type ReviewLockLifecycle } from '../../api/use-submission';
import type { ReviewSubmission } from '../../types';
import { Note } from '../primitives';

import { PreviousAttempt } from './previous-attempt';
import { SubmissionHeader } from './submission-header';

export interface SubmissionPanelProps {
  school: string;
  id: string;
  /** Where this one sits in the queue on screen; absent on its own page. */
  position?: { index: number; total: number } | null;
}

/**
 * One submission, open.
 *
 * The panel loads its own data rather than taking it from the queue: the row carries a
 * name and an age, and everything a verdict is made on — the breakdown, the answer key,
 * the previous try — is recomputed per read and far too heavy to have travelled with a
 * list of fifty.
 *
 * Opening it marks the submission for this teacher. The marker is advisory and every
 * failure around it is a line on the screen rather than a closed door: see
 * `useReviewLock`.
 *
 * The breakdown and the decision panel arrive in 45.6 and 45.7. What is here now is the
 * half that answers "what am I looking at, and is anything wrong with it" — which is the
 * half every one of the five edge states in `BEHAVIOR.md` §B lives in.
 */
export function SubmissionPanel({ school, id, position = null }: SubmissionPanelProps) {
  const t = useTranslations('Review');
  const { data, isPending, isError } = useSubmission(school, id);
  // Nothing is claimed on a submission somebody has already decided: the marker's whole
  // purpose is to keep two teachers off one open piece of work.
  const lock = useReviewLock(school, id, {
    enabled: data !== undefined && data.decision === null && data.canDecide,
  });

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-5" aria-busy>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Note tone="error" title={t('submission.failed.title')}>
          {t('submission.failed.body')}
        </Note>
      </div>
    );
  }

  return (
    <article className="flex min-h-0 flex-1 flex-col">
      <SubmissionHeader submission={data} position={position} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        <SubmissionNotes submission={data} lock={lock} />
        {data.previous === null ? null : <PreviousAttempt verdict={data.previous} />}
      </div>
    </article>
  );
}

/**
 * Everything the reviewer should know before deciding, in the order it changes what they
 * do: what is already settled, then what they may not do, then what is merely missing.
 *
 * A conflict comes first because it makes the rest of the screen a record rather than a
 * decision. A colleague's live marker comes last of the three warnings because it forbids
 * nothing at all — it is a nudge to go and mark something else, and the reviewer who
 * ignores it is still answered honestly.
 */
function SubmissionNotes({
  submission,
  lock,
}: {
  submission: ReviewSubmission;
  lock: ReviewLockLifecycle;
}) {
  const t = useTranslations('Review.submission');
  const format = useFormatter();

  // The claim's own answer, not the marker the read came with: claiming never displaces a
  // live marker, so what comes back from it is the current holder — and until it comes
  // back there is nothing to say, since the holder might well be this reviewer.
  const heldByColleague = lock.state !== null && lock.state.lock !== null && !lock.state.mine;
  const holder = lock.state?.lock ?? null;

  return (
    <>
      {submission.decision === null ? null : (
        <Note
          tone="warn"
          icon={UserCheck}
          title={t('conflict.title', {
            name: submission.decision.reviewerName ?? t('conflict.someone'),
          })}
        >
          {t(
            submission.decision.outcome === 'approved' ? 'conflict.approved' : 'conflict.returned',
            { time: format.dateTime(new Date(submission.decision.at), { timeStyle: 'short' }) },
          )}
        </Note>
      )}

      {submission.canDecide ? null : (
        <Note tone="error" icon={ShieldAlert} title={t('windowExpired.title')}>
          {t('windowExpired.body')}
        </Note>
      )}

      {lock.expired ? (
        <Note tone="info" icon={Clock} title={t('lockExpired.title')}>
          {t('lockExpired.body')}
        </Note>
      ) : null}

      {heldByColleague ? (
        <Note
          tone="muted"
          icon={Lock}
          title={t('heldBy.title', {
            name: holder?.teacherName ?? t('conflict.someone'),
          })}
        >
          {t('heldBy.body')}
        </Note>
      ) : null}

      {submission.exercise.available ? null : (
        <Note tone="muted" icon={CircleSlash} title={t('exerciseGone.title')}>
          {t('exerciseGone.body')}
        </Note>
      )}

      {submission.details === null ? (
        <Note tone="warn" icon={FileQuestion} title={t('noDetails.title')}>
          {t('noDetails.body')}
        </Note>
      ) : null}
    </>
  );
}
