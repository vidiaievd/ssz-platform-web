'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useSrsReview } from '../../api/use-srs-review';
import { useSrsSessionStore } from '../../stores/srs-session-store';
import type { ReviewRating } from '../../types';
import { RatingBar } from './rating-bar';
import { ReviewCard } from './review-card';
import { SessionProgress } from './session-progress';

export function SrsSession() {
  const t = useTranslations('Srs');
  const {
    queue,
    index,
    cardState,
    reviewedCount,
    revealAnswer,
    advanceAfterRating,
    setPhase,
    setLimitHit,
    setPendingRating,
  } = useSrsSessionStore();

  const card = queue[index];
  const total = queue.length;

  const showAnswerRef = useRef<HTMLButtonElement | null>(null);
  const goodButtonRef = useRef<HTMLButtonElement | null>(null);

  const currentCardId = card?.id ?? '';
  const { mutate: submitReview, isPending } = useSrsReview(currentCardId);

  const handleRate = useCallback((rating: ReviewRating) => {
    if (!card || cardState !== 'revealed' || isPending) return;

    setPendingRating(rating);

    const idempotencyKey = crypto.randomUUID();
    const latencyMs = 0; // F4.2 will track the real latency

    submitReview(
      { rating, latencyMs, idempotencyKey },
      {
        onSuccess: ({ streakDays, milestone }) => {
          if (milestone) {
            toast(t('toast.milestone', { days: milestone }));
          }
          advanceAfterRating(rating, streakDays);
        },
        onError: (err) => {
          if (err.message === 'rate_limited') {
            setLimitHit();
          } else {
            toast.error(t('toast.reviewError'));
          }
        },
      },
    );
  }, [card, cardState, isPending, submitReview, advanceAfterRating, setLimitHit, setPendingRating, t]);

  /* Focus management */
  useEffect(() => {
    if (cardState === 'front') {
      showAnswerRef.current?.focus();
    } else if (cardState === 'revealed') {
      goodButtonRef.current?.focus();
    }
  }, [cardState, index]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setPhase('entry');
        return;
      }
      if (cardState === 'front' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        revealAnswer();
        return;
      }
      if (cardState === 'revealed') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 4) {
          handleRate(num as ReviewRating);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardState, handleRate, index, revealAnswer, setPhase]);

  /* Announcement for screen readers */
  const announceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!announceRef.current) return;
    if (cardState === 'front') {
      announceRef.current.textContent = t('session.newCardAnnounce', {
        n: reviewedCount + 1,
        total,
      });
    } else if (cardState === 'revealed') {
      announceRef.current.textContent = t('session.answerShownAnnounce');
    }
  }, [cardState, index, reviewedCount, t, total]);

  if (!card) return null;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--ssz-bg-base)' }}>
      {/* Slim progress bar + exit */}
      <div className="mx-auto w-full max-w-[40rem] px-4">
        <SessionProgress
          done={reviewedCount}
          total={total}
          onExit={() => setPhase('entry')}
        />
      </div>

      {/* Aria-live region */}
      <div
        ref={announceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Card */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-4 pt-2">
        <div className="w-full max-w-[40rem]">
          <ReviewCard
            card={card}
            cardState={cardState}
            onReveal={revealAnswer}
            showAnswerRef={showAnswerRef}
          />
        </div>
      </div>

      {/* Rating bar — only shown when revealed */}
      {(cardState === 'revealed' || cardState === 'advancing') && (
        <RatingBar
          card={card}
          disabled={isPending || cardState === 'advancing'}
          onRate={handleRate}
          goodButtonRef={goodButtonRef}
        />
      )}
    </div>
  );
}
