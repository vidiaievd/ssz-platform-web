'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useSrsReview } from '../../api/use-srs-review';
import { useSrsSessionStore } from '../../stores/srs-session-store';
import type { ReviewRating } from '../../types';
import { RatingBar, RATING_BY_SHORTCUT } from './rating-bar';
import { RetryBar } from './retry-bar';
import { ReviewCard } from './review-card';
import { SessionProgress } from './session-progress';

/** Advancing overlay (no white flash while next card loads from buffer). */
const ADVANCE_DELAY_MS = 200;

export function SrsSession() {
  const t = useTranslations('Srs');
  const {
    queue,
    index,
    cardState,
    reviewedCount,
    currentIdempotencyKey,
    ratingError,
    carryOnPastLimit,
    revealAnswer,
    advanceAfterRating,
    setCardState,
    setPhase,
    setLimitHit,
    setRatingError,
    clearRatingError,
  } = useSrsSessionStore();

  const card = queue[index];
  const total = queue.length;

  const showAnswerRef = useRef<HTMLButtonElement | null>(null);
  const goodButtonRef = useRef<HTMLButtonElement | null>(null);

  /* ── Focus management ──────────────────────────────────────────── */
  useEffect(() => {
    if (cardState === 'front') {
      showAnswerRef.current?.focus();
    } else if (cardState === 'revealed') {
      goodButtonRef.current?.focus();
    }
  }, [cardState, index]);

  /* ── aria-live announcements ────────────────────────────────────── */
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

  /* ── Rating ─────────────────────────────────────────────────────── */
  const currentCardId = card?.id ?? '';
  const { mutate: submitReview, isPending } = useSrsReview(currentCardId);

  const handleRate = useCallback(
    (rating: ReviewRating) => {
      if (!card || cardState !== 'revealed' || isPending) return;

      const idempotencyKey = currentIdempotencyKey ?? crypto.randomUUID();
      // The answer is dated when it was given, not when it reached the server.
      const reviewedAt = new Date().toISOString();

      // Show the advancing overlay immediately — no white flash.
      setCardState('advancing');

      // After the visual gate, advance optimistically from the local buffer.
      const advanceTimer = setTimeout(() => {
        advanceAfterRating(rating);
      }, ADVANCE_DELAY_MS);

      submitReview(
        // Carried on every review of a session the learner chose to continue — the
        // cap is checked per submission, so sending it once would not be enough.
        { rating, reviewedAt, idempotencyKey, ...(carryOnPastLimit ? { carryOnPastLimit } : {}) },
        {
          onSuccess: () => {
            clearTimeout(advanceTimer);
            advanceAfterRating(rating);
          },
          onError: (err) => {
            clearTimeout(advanceTimer);
            if (err.message === 'rate_limited') {
              setLimitHit();
            } else {
              // Roll back the advancing overlay and show the inline retry bar.
              setRatingError({
                rating,
                message: t('toast.reviewError'),
              });
              toast.error(t('toast.reviewError'), { id: 'srs-review-error' });
            }
          },
        },
      );
    },
    [
      card,
      cardState,
      isPending,
      currentIdempotencyKey,
      carryOnPastLimit,
      setCardState,
      advanceAfterRating,
      submitReview,
      setLimitHit,
      setRatingError,
      t,
    ],
  );

  /* Retry — reuses the same idempotency key (server-deduped on reconnect). */
  const handleRetry = useCallback(() => {
    if (!ratingError) return;
    clearRatingError();
    handleRate(ratingError.rating);
  }, [ratingError, clearRatingError, handleRate]);

  /* ── Keyboard shortcuts ─────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never fire while focus is in a form field.
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
      // Number keys 1-4 are no-ops until the card is revealed.
      if (cardState === 'revealed') {
        const rating = RATING_BY_SHORTCUT[parseInt(e.key)];
        if (rating) handleRate(rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardState, handleRate, revealAnswer, setPhase]);

  if (!card) return null;

  const ratingDisabled = isPending || cardState === 'advancing';

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--ssz-bg-base)' }}>
      {/* Progress bar + exit */}
      <div className="mx-auto w-full max-w-[40rem] px-4">
        <SessionProgress
          done={reviewedCount}
          total={total}
          onExit={() => setPhase('entry')}
        />
      </div>

      {/* aria-live region — announces new card and reveal to screen readers */}
      <div
        ref={announceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Card + inline retry */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-4 pt-2">
        <div className="w-full max-w-[40rem] space-y-3">
          <ReviewCard
            card={card}
            cardState={cardState}
            onReveal={revealAnswer}
            showAnswerRef={showAnswerRef}
          />

          {ratingError && (
            <RetryBar
              rating={ratingError.rating}
              message={ratingError.message}
              onRetry={handleRetry}
              onDismiss={clearRatingError}
            />
          )}
        </div>
      </div>

      {/* Rating bar — only shown when revealed or advancing */}
      {(cardState === 'revealed' || cardState === 'advancing') && (
        <RatingBar
          card={card}
          disabled={ratingDisabled}
          onRate={handleRate}
          goodButtonRef={goodButtonRef}
        />
      )}
    </div>
  );
}
