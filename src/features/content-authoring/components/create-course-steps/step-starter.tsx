'use client';

import { useTranslations } from 'next-intl';
import { Plus, Zap, Clipboard } from 'lucide-react';

import { useCreateCourseStore, type Starter } from '../../stores/create-course';
import { SelectCard } from '../select-card';

const STARTERS: { value: Starter; icon: React.FC<{ className?: string }>; titleKey: string; descKey: string; recommended?: boolean; disabled?: boolean }[] = [
  { value: 'blank', icon: Plus, titleKey: 'starter.blank', descKey: 'starter.blankDesc' },
  { value: 'cefr', icon: Zap, titleKey: 'starter.cefr', descKey: 'starter.cefrDesc', recommended: true },
  { value: 'clone', icon: Clipboard, titleKey: 'starter.clone', descKey: 'starter.cloneDesc', disabled: true },
];

/** Starter step — picks the seed content for the new course ("blank" | "cefr" | "clone"). Clone is disabled until the backend duplicate endpoint ships. */
export function StepStarter() {
  const t = useTranslations('Authoring.createCourse');
  const { starter, setStarter } = useCreateCourseStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-(--ssz-text-primary) font-[Lora]">
          {t('starter.heading')}
        </h2>
        <p className="mt-1 text-sm text-(--ssz-text-secondary)">{t('starter.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('starter.heading')}>
        {STARTERS.map((opt) => (
          <SelectCard
            key={opt.value}
            selected={starter === opt.value}
            icon={opt.icon}
            title={t(opt.titleKey as Parameters<typeof t>[0])}
            description={t(opt.descKey as Parameters<typeof t>[0])}
            onClick={() => setStarter(opt.value)}
            badge={opt.recommended ? t('starter.recommended') : undefined}
            disabled={opt.disabled}
            disabledNote={opt.disabled ? t('starter.cloneComingSoon') : undefined}
          />
        ))}
      </div>
    </div>
  );
}
