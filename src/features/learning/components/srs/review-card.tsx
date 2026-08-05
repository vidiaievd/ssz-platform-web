'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SrsCard } from '../../types';
import type { CardState } from '../../stores/srs-session-store';
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
  // Content is resolved server-side and only for vocabulary cards; a card
  // without it is filtered out before the queue reaches this component.
  const front = card.front;
  const back = card.back;

  if (!front) return null;

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
        <div className="flex flex-wrap items-center gap-2">
          {front.partOfSpeech && <PosChip pos={front.partOfSpeech} />}
          {front.ipaTranscription && (
            <span className="text-sm text-[var(--ssz-text-muted)]">{front.ipaTranscription}</span>
          )}
        </div>

        <h2
          className="font-[var(--ssz-font-reading)] text-3xl font-semibold leading-[var(--ssz-leading-snug)] text-[var(--ssz-text-primary)] md:text-4xl"
          lang="und"
        >
          {front.word}
        </h2>

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
      {isRevealed && back && (
        <div className="mt-8 space-y-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--ssz-duration-base,200ms)] motion-safe:ease-[var(--ssz-ease-out)]">
          <div className="border-t border-[var(--ssz-border-default)] pt-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ssz-text-muted)]">
              {t('card.definitionLabel')}
            </p>
            {back.translation ? (
              <p className="text-lg font-semibold text-[var(--ssz-text-primary)]">
                {back.translation}
              </p>
            ) : (
              <p className="text-sm italic text-[var(--ssz-text-muted)]">
                {t('card.noTranslation')}
              </p>
            )}

            {back.alternativeTranslations.length > 0 && (
              <p className="mt-1 text-sm text-[var(--ssz-text-secondary)]">
                {back.alternativeTranslations.join(', ')}
              </p>
            )}

            {back.definition && (
              <p className="mt-2 text-sm text-[var(--ssz-text-secondary)]">{back.definition}</p>
            )}

            {/* The requested language had no translation — say which one is shown. */}
            {back.fallbackUsed && back.translationLanguage && (
              <p className="mt-2 text-xs text-[var(--ssz-text-muted)]">
                {t('card.fallbackLanguage', { language: back.translationLanguage })}
              </p>
            )}
          </div>

          {back.usageNotes && (
            <p className="text-sm text-[var(--ssz-text-secondary)]">{back.usageNotes}</p>
          )}

          {back.examples.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ssz-text-muted)]">
                {t('card.examplesLabel')}
              </p>
              {back.examples.map((example, i) => (
                <SampleSentence key={i} sentence={example} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
