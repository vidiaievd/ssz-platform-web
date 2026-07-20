'use client';

import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';
import { CoverArt } from './cover-art';
import { AccessMarker, resolveAccessState } from './access-marker';

export interface CourseCatalogCardProps {
  container: Container;
  href: string;
  isEnrolled?: boolean;
}

export function CourseCatalogCard({ container, href, isEnrolled = false }: CourseCatalogCardProps) {
  const t = useTranslations('Catalog');

  const accessState = resolveAccessState(container.accessTier, isEnrolled);

  const markerLabels = {
    enrolled: t('enrolled'),
    locked: t('locked'),
    free: t('free'),
  };

  return (
    <Link href={href} className="group block h-full text-left" aria-label={container.title}>
      <div
        className={
          'flex h-full flex-col rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-3 shadow-(--ssz-shadow-xs) ' +
          'transition-[border-color,box-shadow,transform] duration-base ' +
          'group-hover:-translate-y-0.5 group-hover:border-(--ssz-color-primary-500) group-hover:shadow-(--ssz-shadow-md) ' +
          'group-focus-within:outline-2 group-focus-within:outline-(--ssz-border-focus)'
        }
      >
        <CoverArt langCode={container.targetLanguage} level={container.difficultyLevel} />

        <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
          <h3 className="text-[15.5px] leading-[1.3] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
            {container.title}
          </h3>

          {container.description && (
            <p className="line-clamp-2 text-[12.5px] leading-normal text-(--ssz-text-secondary)">
              {container.description}
            </p>
          )}

          <div className="mt-auto flex items-center gap-3 pt-1.5 text-xs text-(--ssz-text-secondary)">
            {container.lessonCount != null && (
              <span className="inline-flex items-center gap-1">
                <Target size={13} className="text-(--ssz-text-muted)" aria-hidden="true" />
                {t('canDoGoals', { count: container.lessonCount })}
              </span>
            )}
          </div>

          <div className="mt-1">
            <AccessMarker state={accessState} schoolName={container.ownerName} labels={markerLabels} />
          </div>
        </div>
      </div>
    </Link>
  );
}
