'use client';

import { useTranslations } from 'next-intl';
import { Layers, Settings, List } from 'lucide-react';

import { useCreateCourseStore, type LevelSystem } from '../../stores/create-course';
import { SelectCard } from '../select-card';

const LEVEL_SYSTEMS: { value: LevelSystem; icon: React.FC<{ className?: string }>; titleKey: string; descKey: string }[] = [
  { value: 'cefr', icon: Layers, titleKey: 'levels.cefr', descKey: 'levels.cefrDesc' },
  { value: 'custom', icon: Settings, titleKey: 'levels.custom', descKey: 'levels.customDesc' },
  { value: 'single', icon: List, titleKey: 'levels.single', descKey: 'levels.singleDesc' },
];

/** Levels step — picks the course's `levelSystem` (cefr | custom | single). */
export function StepLevels() {
  const t = useTranslations('Authoring.createCourse');
  const { levelSystem, setLevelSystem } = useCreateCourseStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-(--ssz-text-primary) font-[Lora]">
          {t('levels.heading')}
        </h2>
        <p className="mt-1 text-sm text-(--ssz-text-secondary)">{t('levels.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('levels.heading')}>
        {LEVEL_SYSTEMS.map((opt) => (
          <SelectCard
            key={opt.value}
            selected={levelSystem === opt.value}
            icon={opt.icon}
            title={t(opt.titleKey as Parameters<typeof t>[0])}
            description={t(opt.descKey as Parameters<typeof t>[0])}
            onClick={() => setLevelSystem(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}
