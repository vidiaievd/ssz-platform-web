'use client';

import { Repeat, Shuffle, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useSrsDue } from '@/features/learning/api/use-srs-due';
import { useRouter } from '@/lib/i18n/navigation';
import { HSection } from './h-section';
import { TextLink } from './text-link';
import { TrainingTile, type TrainingTileData } from './training-tile';

/**
 * The two training entry points that real data can back today. The full hub
 * (practice-by-type, recommended-now) lands with the Training screen; this row
 * deliberately ships only what it can populate honestly.
 */
export function QuickTraining() {
  const t = useTranslations('Student.home.training');
  const router = useRouter();
  const { data } = useSrsDue();

  const dueCount = data?.dueCount ?? 0;

  const tiles: Array<TrainingTileData & { href: string }> = [
    {
      id: 'review',
      icon: Repeat,
      hue: 168,
      label: t('reviewLabel'),
      description: t('reviewDescription'),
      meta: t('reviewMeta', { count: dueCount }),
      disabled: dueCount === 0,
      href: '/student/srs',
    },
    {
      id: 'mixed',
      icon: Shuffle,
      hue: 235,
      label: t('mixedLabel'),
      description: t('mixedDescription'),
      href: '/student/training',
    },
  ];

  return (
    <section>
      <HSection
        icon={Zap}
        title={t('title')}
        sub={t('subtitle')}
        action={
          <TextLink onClick={() => router.push('/student/training')}>{t('allTraining')}</TextLink>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <TrainingTile key={tile.id} tile={tile} size="lg" onOpen={() => router.push(tile.href)} />
        ))}
      </div>
    </section>
  );
}
