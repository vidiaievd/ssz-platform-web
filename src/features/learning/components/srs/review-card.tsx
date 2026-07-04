'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SrsCard } from '../../types';
import type { CardState } from '../../stores/srs-session-store';
import { AudioButton } from './audio-button';
import { PosChip } from './pos-chip';
import { SampleSentence } from './sample-sentence';

interface ReviewCardProps {
  card: SrsCard;
  cardState: CardState;
  onReveal: () => void;
  /** Ref forwarded to the Show-answer button so focus can land here on every new card. */
  showAnswerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function ReviewCard({ card, cardState, onReveal, showAnswerRef }: ReviewCardProps) {
  const t = useTranslations('Srs');
  const isRevealed = cardState === 'revealed' || cardState === 'advancing';
  const isAdvancing = cardState === 'advancing';
  const directionKey =
    card.direction === 'reverse' ? 'card.directionReverse' : 'card.directionForward';

  return (
    <div
      className={cn(
        'relative w-full rounded-[var(--ssz-radius-xl)] border border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)] shadow-[var(--ssz-shadow-md)] p-8 md:p-10',
        'min-h-[320px]',
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) return;
        if (!isRevealed) onReveal();
      }}
    >
      {/* Advancing overlay */}
      {isAdvancing && (
        <div className="absolute inset-0 z-10 rounded-[var(--ssz-radius-xl)] bg-[var(--ssz-bg-surface)]/60 backdrop-blur-[1px]" />
      )}

      {/* Front */}
      <div className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ssz-text-muted)]">
          {t(directionKey)}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {card.front.pos && <PosChip pos={card.front.pos} />}
          {card.front.audioUrl && <AudioButton src={card.front.audioUrl} />}
        </div>

        <h2
          className="font-[var(--ssz-font-reading)] text-3xl font-semibold leading-[var(--ssz-leading-snug)] text-[var(--ssz-text-primary)] md:text-4xl"
          lang="und"
        >
          {card.front.word}
        </h2>

        {card.front.listName && (
          <p className="flex items-center gap-1 text-sm text-[var(--ssz-text-muted)]">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t('card.fromList', { list: card.front.listName })}
          </p>
        )}

        {!isRevealed && (
          <Button
            ref={showAnswerRef}
            onClick={(e) => {
              e.stopPropagation();
              onReveal();
            }}
            className="mt-6 w-full"
          >
            {t('card.showAnswer')}
            <span className="ml-2 font-mono text-xs opacity-60">Space</span>
          </Button>
        )}
      </div>

      {/* Back — animates in below front on reveal */}
      {isRevealed && (
        <div className="mt-8 space-y-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--ssz-duration-base,200ms)] motion-safe:ease-[var(--ssz-ease-out)]">
          <div className="border-t border-[var(--ssz-border-default)] pt-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ssz-text-muted)]">
              {t('card.definitionLabel')}
            </p>
            <p className="text-lg font-semibold text-[var(--ssz-text-primary)]">
              {card.back.definition}
            </p>
          </div>

          {card.back.sentences.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ssz-text-muted)]">
                {t('card.examplesLabel')}
              </p>
              {card.back.sentences.map((s, i) => (
                <SampleSentence key={i} sentence={s} />
              ))}
            </div>
          )}

          {card.back.imageUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-[var(--ssz-radius-md)] bg-[var(--ssz-bg-subtle)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.back.imageUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
