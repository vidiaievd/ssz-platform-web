'use client';

import { BookOpen, ChevronRight, Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ErrorState, LearningSkeleton } from '@/features/learning';
import { useUnitVocabularyItems, useVocabularyList } from '@/features/content';
import { Link } from '@/lib/i18n/navigation';
import type { DifficultyLevel } from '@/features/content/types';

import { VocabFlipCard, type VocabCardMode } from './vocab-flip-card';
import type { ReaderSidebarItem } from '../types';

export function getVocabCardMode(cefrLevel: string): VocabCardMode {
  return cefrLevel === 'B2' || cefrLevel === 'C1' || cefrLevel === 'C2' ? 'definition' : 'translation';
}

function findReinforceItem(
  siblingItems: ReaderSidebarItem[],
  currentItemId: string,
): ReaderSidebarItem | undefined {
  const currentIndex = siblingItems.findIndex((i) => i.id === currentItemId);
  const after = siblingItems.slice(currentIndex + 1);
  const before = siblingItems.slice(0, currentIndex === -1 ? 0 : currentIndex);
  return [...after, ...before].find((i) => i.kind !== 'vocab' && i.status !== 'locked');
}

export interface VocabularyPageProps {
  vocabularyListId: string;
  cefrLevel: DifficultyLevel | string;
  unitPosition: number;
  courseTitle: string;
  srsVocabDue: number;
  siblingItems: ReaderSidebarItem[];
  currentItemId: string;
}

export function VocabularyPage({
  vocabularyListId,
  cefrLevel,
  unitPosition,
  courseTitle,
  srsVocabDue,
  siblingItems,
  currentItemId,
}: VocabularyPageProps) {
  const t = useTranslations('Learning.reader.vocab');
  const tContent = useTranslations('Content');

  const list = useVocabularyList(vocabularyListId);
  const items = useUnitVocabularyItems(vocabularyListId);

  const isLoading = list.isLoading || items.isLoading;
  const isError = list.isError || items.isError;

  if (isLoading) {
    return <LearningSkeleton variant="card" rows={4} />;
  }

  if (isError || !list.data || !items.data) {
    return (
      <ErrorState
        onRetry={() => {
          list.refetch();
          items.refetch();
        }}
      />
    );
  }

  if (items.data.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('page.emptyTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('page.emptyBody')}</p>
      </div>
    );
  }

  const cardMode = getVocabCardMode(cefrLevel);
  const reinforceItem = findReinforceItem(siblingItems, currentItemId);
  const showReviewCard = srsVocabDue > 0;

  return (
    <div>
      <div className="mb-3.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
          {t('page.eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.vocab') })}
        </div>
        <h1 className="font-reading mb-1 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {list.data.title}
        </h1>
        <div className="text-sm text-(--ssz-text-muted) italic">
          {t('page.newWords', { count: items.data.length })}
        </div>
      </div>

      {/* how-to strip */}
      <div className="mb-5 flex flex-wrap items-center gap-3.5 rounded-xl border-[1.5px] border-(--ssz-color-primary-200) bg-(--ssz-color-primary-50) px-4 py-3">
        <Repeat size={18} className="shrink-0 text-(--ssz-color-primary-600)" aria-hidden="true" />
        <div className="min-w-55 flex-1 text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">
          {cardMode === 'definition' ? t('page.howToDefinition') : t('page.howToTranslation')}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-(--ssz-color-primary-300) bg-surface px-2.5 py-1 text-[11px] font-bold text-(--ssz-color-primary-600)">
          {cardMode === 'definition' ? t('page.levelBadgeDefinition') : t('page.levelBadgeTranslation')}
        </span>
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.data.map((item) => (
          <VocabFlipCard key={item.id} item={item} cardMode={cardMode} />
        ))}
      </div>

      {/* reinforce + review */}
      {(reinforceItem || showReviewCard) && (
        <div className="mt-6.5 border-t border-(--ssz-border-default) pt-5.5">
          <div className="mb-3 text-[11px] font-bold tracking-wider text-(--ssz-text-muted) uppercase">
            {t('page.nextHeading')}
          </div>
          <div className="flex flex-col gap-2.5">
            {reinforceItem && (
              <Link
                href={reinforceItem.href}
                className="flex items-center gap-3 rounded-xl border-[1.5px] border-(--ssz-border-default) bg-surface px-4 py-3.5 shadow-(--ssz-shadow-xs) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              >
                <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-md bg-(--ssz-color-primary-100)">
                  <BookOpen size={18} className="text-(--ssz-color-primary-600)" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-(--ssz-text-primary)">{reinforceItem.title}</div>
                  <div className="text-xs text-(--ssz-text-muted)">
                    {tContent(`materialType.${reinforceItem.kind}`)}
                  </div>
                </div>
                <ChevronRight size={18} className="text-(--ssz-text-muted)" aria-hidden="true" />
              </Link>
            )}
            {showReviewCard && (
              <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-(--ssz-color-warning-300) bg-(--ssz-color-warning-50) px-4 py-3.5">
                <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-md bg-(--ssz-color-warning-100)">
                  <Repeat size={18} className="text-(--ssz-color-warning-500)" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-(--ssz-text-primary)">{t('page.reviewTitle')}</div>
                  <div className="text-xs text-(--ssz-text-secondary)">
                    {t('page.reviewBody', { count: srsVocabDue })}
                  </div>
                </div>
                <Link
                  href="/student/srs"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-(--ssz-color-warning-300) bg-surface px-3.5 py-2 text-xs font-semibold text-(--ssz-color-warning-700) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                >
                  <Repeat size={13} aria-hidden="true" />
                  {t('page.reviewCta')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
