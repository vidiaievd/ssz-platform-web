'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  FileQuestion,
  Lock,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useReviewDecision, type ReviewConflict, type ReviewVerdict } from '../../api/use-decision';
import { useReviewLock, useSubmission, type ReviewLockLifecycle } from '../../api/use-submission';
import { DEFAULT_FILTERS } from '../../lib/queue-filters';
import { selectDraft, useReviewDraftsStore } from '../../stores/review-drafts';
import type { ReviewQueueFilters, ReviewSubmission } from '../../types';
import { Note } from '../primitives';

import { DecisionPanel } from './decision-panel';
import { PreviousAttempt } from './previous-attempt';
import { SentenceList } from './sentence-list';
import { SubmissionHeader } from './submission-header';

/**
 * Long enough to see what happened, short enough not to be a pause.
 *
 * A verdict that moved the screen instantly would leave a teacher unsure whether the one
 * they meant to return was returned; a second of confirmation, twenty times an hour, is a
 * different and worse cost (`BEHAVIOR.md` §B).
 */
const ADVANCE_DELAY_MS = 450;

export interface SubmissionPanelProps {
  school: string;
  id: string;
  /** Where this one sits in the queue on screen; absent on its own page. */
  position?: { index: number; total: number } | null;
  /**
   * The queue as the reviewer has it arranged. Travels with the verdict, because what
   * "the next one" means is this list and not the server's idea of a default one.
   */
  filters?: ReviewQueueFilters;
  /**
   * The row after this one in the queue on screen. Only used when there is no verdict to
   * ask the server for a successor with — a conflict, or an assignment that has run out.
   */
  nextInQueue?: string | null;
  /**
   * Where to go once a verdict has landed. The inbox rewrites its address bar; on the
   * submission's own page the default below swaps the last path segment.
   */
  onAdvance?: (nextId: string) => void;
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
 * The verdict is the one thing that moves the screen. It goes out with whatever the
 * reviewer has written, comes back naming the next submission, and half a second later
 * the panel is showing that one instead — the queue on the left is never returned to
 * (criterion 16). What the reviewer wrote lives in `review-drafts`, not here, so that a
 * colleague answering first costs them the verdict and not their words.
 */
export function SubmissionPanel({
  school,
  id,
  position = null,
  filters = DEFAULT_FILTERS,
  nextInQueue = null,
  onAdvance,
}: SubmissionPanelProps) {
  const t = useTranslations('Review');
  const router = useRouter();
  const pathname = usePathname();

  const draft = useReviewDraftsStore(selectDraft(id));
  const setComment = useReviewDraftsStore((state) => state.setComment);
  const setSentenceComment = useReviewDraftsStore((state) => state.setSentenceComment);
  const clearDraft = useReviewDraftsStore((state) => state.clear);

  // What this reviewer's own verdict was, until the screen moves on. Held rather than
  // read back from the submission, because the whole point is to say what happened
  // before the next read has been made.
  const [sent, setSent] = useState<'approved' | 'returned' | null>(null);
  const [finished, setFinished] = useState(false);
  // A colleague's verdict, as the refusal reported it. The refetched submission carries
  // the same fact a moment later; this is what the banner is drawn from meanwhile.
  const [conflict, setConflict] = useState<ReviewConflict | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  // The step forward is a timer, so it has to be cancellable: a reviewer who clicks
  // another row in the half-second after a verdict must not be dragged onward from the
  // submission they just left.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const { data, isPending, isError } = useSubmission(school, id);
  const decision = useReviewDecision(school, id, filters);
  // Nothing is claimed on a submission somebody has already decided: the marker's whole
  // purpose is to keep two teachers off one open piece of work.
  const lock = useReviewLock(school, id, {
    enabled: data !== undefined && data.decision === null && data.canDecide && sent === null,
  });

  const onComment = useCallback(
    (itemId: string, value: string | undefined) => setSentenceComment(id, itemId, value),
    [id, setSentenceComment],
  );

  const advance = useCallback(
    (nextId: string) => {
      if (onAdvance) {
        onAdvance(nextId);
        return;
      }
      // The submission's own page: same route, different id. `replace`, so a marking pass
      // does not bury the way back under twenty history entries.
      router.replace(`${pathname.replace(/[^/]+$/, '')}${nextId}`, { scroll: false });
    },
    [onAdvance, pathname, router],
  );

  const decide = useCallback(
    (verdict: ReviewVerdict) => {
      setConflict(null);
      decision.mutate(
        { verdict, comment: draft.comment.trim(), sentenceComments: draft.sentences },
        {
          onSuccess: (result) => {
            // The reviewer's own verdict — the one thing that empties their draft.
            clearDraft(id);
            setSent(verdict === 'returned' ? 'returned' : 'approved');
            advanceTimer.current = setTimeout(() => {
              if (result.nextId === null) setFinished(true);
              else advance(result.nextId);
            }, ADVANCE_DELAY_MS);
          },
          onError: (error) => {
            if (error.conflict !== null) setConflict(error.conflict);
          },
        },
      );
    },
    [advance, clearDraft, decision, draft.comment, draft.sentences, id],
  );

  // A refusal about the comment belongs in the comment field, cursor included.
  useEffect(() => {
    if (decision.error?.code === 'RETURN_REQUIRES_COMMENT') commentRef.current?.focus();
  }, [decision.error]);

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

  // The queue ran out under the reviewer's hands. Said where the submission was, because
  // that is where they are looking, and it is an achievement rather than an empty screen.
  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span aria-hidden className="flex text-(--ssz-text-muted)">
          <CheckCircle2 className="h-9 w-9" style={{ color: 'oklch(0.50 0.12 145)' }} />
        </span>
        <p className="text-[17px] font-bold tracking-tight">{t('inbox.empty.title')}</p>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
          {t('inbox.empty.body')}
        </p>
      </div>
    );
  }

  const settled = sent ?? verdictOf(data, conflict);

  return (
    <article className="flex min-h-0 flex-1 flex-col">
      <SubmissionHeader submission={data} position={position} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        <SubmissionNotes submission={data} lock={lock} conflict={conflict} />
        {data.previous === null ? null : <PreviousAttempt verdict={data.previous} />}
        <SentenceList submission={data} comments={draft.sentences} onComment={onComment} />
      </div>

      <DecisionPanel
        comment={draft.comment}
        onCommentChange={(value) => setComment(id, value)}
        hasSentenceComments={Object.keys(draft.sentences).length > 0}
        onDecide={decide}
        pending={decision.isPending}
        error={
          decision.error?.code === 'RETURN_REQUIRES_COMMENT'
            ? t('decision.returnRequiresComment')
            : decision.error !== null && decision.error.status !== 409
              ? t('decision.failed')
              : null
        }
        settled={settled}
        canDecide={data.canDecide}
        onNext={() => {
          if (nextInQueue !== null) advance(nextInQueue);
        }}
        hasNext={nextInQueue !== null}
        inputRef={commentRef}
      />
    </article>
  );
}

/** Whose verdict already stands on this submission, if anyone's. */
function verdictOf(
  submission: ReviewSubmission,
  conflict: ReviewConflict | null,
): 'approved' | 'returned' | null {
  return submission.decision?.outcome ?? conflict?.verdict ?? null;
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
  conflict,
}: {
  submission: ReviewSubmission;
  lock: ReviewLockLifecycle;
  /** The colleague's verdict as the refusal reported it, before the read catches up. */
  conflict: ReviewConflict | null;
}) {
  const t = useTranslations('Review.submission');
  const format = useFormatter();

  // The claim's own answer, not the marker the read came with: claiming never displaces a
  // live marker, so what comes back from it is the current holder — and until it comes
  // back there is nothing to say, since the holder might well be this reviewer.
  const heldByColleague = lock.state !== null && lock.state.lock !== null && !lock.state.mine;
  const holder = lock.state?.lock ?? null;

  // Whichever of the two knows about the colleague's verdict first. The refusal answers
  // in the same breath as the failed attempt; the refetched submission agrees a moment
  // later, and by then it is the better source, since it carries the name from the
  // directory rather than from an error body.
  const standing =
    submission.decision !== null
      ? {
          name: submission.decision.reviewerName,
          outcome: submission.decision.outcome,
          at: submission.decision.at,
        }
      : conflict !== null
        ? { name: conflict.byName, outcome: conflict.verdict, at: conflict.at }
        : null;

  return (
    <>
      {standing === null ? null : (
        <Note
          tone="warn"
          icon={UserCheck}
          role="alert"
          title={t('conflict.title', { name: standing.name ?? t('conflict.someone') })}
        >
          {t(standing.outcome === 'approved' ? 'conflict.approved' : 'conflict.returned', {
            time: format.dateTime(new Date(standing.at), { timeStyle: 'short' }),
          })}
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
