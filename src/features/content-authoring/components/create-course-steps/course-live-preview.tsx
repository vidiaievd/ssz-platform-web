'use client';

import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';

import { ContainerStateBadge } from '../container-state-badge';
import { useCreateCourseStore } from '../../stores/create-course';
import { useLanguageOptions } from '../../hooks/use-language-options';

/** Sticky "what you're about to create" preview shown alongside the guided wizard. */
export function CourseLivePreview() {
  const t = useTranslations('Authoring.createCourse');
  const { basics, levelSystem } = useCreateCourseStore();
  const languageOptions = useLanguageOptions();
  const langLabel = languageOptions.find((l) => l.code === basics.targetLanguage)?.name;
  const levelsLabel = t(`levels.${levelSystem}` as Parameters<typeof t>[0]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wider text-(--ssz-text-muted)">
        {t('preview.label')}
      </p>

      <div className="overflow-hidden rounded-(--ssz-radius-lg) border-[1.5px] border-(--ssz-border-default) bg-surface shadow-sm">
        <div className="flex h-17.5 items-end bg-linear-to-br from-(--ssz-color-primary-100) to-subtle px-3 pb-2.5 dark:from-(--ssz-color-primary-950)">
          <Globe className="h-6 w-6 text-(--ssz-color-primary-600)" aria-hidden />
        </div>
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm font-bold text-(--ssz-text-primary)">
              {basics.title || t('preview.untitled')}
            </span>
            <ContainerStateBadge state="draft" />
          </div>
          <div className="font-mono text-[11px] text-(--ssz-text-secondary)">
            {langLabel ? `${langLabel} · ` : ''}
            {t('preview.meta', { levels: levelsLabel })}
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-(--ssz-text-muted)">{t('preview.draftNote')}</p>
    </div>
  );
}
