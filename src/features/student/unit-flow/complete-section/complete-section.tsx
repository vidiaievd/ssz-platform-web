'use client';

import { Target, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CanDoItem } from '@/features/learning';
import { cn } from '@/lib/utils';

export interface CompleteSectionProps {
  unitNumber: number;
  unitTitle: string;
  vocabCount: number;
  mistakes: string[];
  canDoDescriptors: CanDoItem[];
  courseHref: string;
}

export function CompleteSection({
  unitNumber,
  unitTitle,
  vocabCount,
  mistakes,
  canDoDescriptors,
  courseHref,
}: CompleteSectionProps) {
  const t = useTranslations('Learning.completeSection');

  const perfectScore = mistakes.length === 0;
  const firstCanDo   = canDoDescriptors[0];

  return (
    <div
      className="flex w-full flex-col items-center"
      style={{ maxWidth: 520, padding: '48px 24px 80px' }}
    >
      {/* Trophy */}
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-[24px]"
        style={{
          background: 'oklch(0.95 0.03 168)',
          border: '2px solid oklch(0.62 0.105 168 / 40%)',
          boxShadow: '0 0 0 10px oklch(0.95 0.03 168)',
        }}
        aria-hidden="true"
      >
        <Trophy size={40} style={{ color: 'var(--ssz-color-primary-500)' }} />
      </div>

      {/* Title */}
      <p
        className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: 'oklch(0.44 0.09 168)' }}
      >
        {t('unitComplete', { unit: unitNumber })}
      </p>
      <h1
        className="mb-2 text-center text-[27px] font-bold leading-snug text-(--ssz-text-primary)"
        style={{ letterSpacing: '-0.02em' }}
      >
        {unitTitle}
      </h1>
      <p className="mb-8 text-center text-[13.5px] text-(--ssz-text-secondary)">
        {t('subtitle')}
      </p>

      {/* Can-do card */}
      {firstCanDo && (
        <div
          className="mb-5 w-full rounded-[16px] px-5 py-5"
          style={{
            background: 'oklch(0.95 0.03 168)',
            border: '2px solid oklch(0.62 0.105 168 / 40%)',
            boxShadow: 'var(--ssz-shadow-sm)',
          }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <Target size={18} style={{ color: 'oklch(0.44 0.09 168)' }} aria-hidden="true" />
            <p
              className="text-[10.5px] font-bold uppercase tracking-[0.06em]"
              style={{ color: 'oklch(0.44 0.09 168)' }}
            >
              {t('canDoLabel')}
            </p>
          </div>
          <p
            className="font-reading text-[16.5px] italic leading-[1.65] text-(--ssz-text-primary)"
          >
            &ldquo;{firstCanDo.descriptor}&rdquo;
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="mb-6 flex w-full gap-3">
        {[
          {
            val: perfectScore ? '✓' : String(mistakes.length),
            label: perfectScore ? t('statPerfect') : t('statMistakes'),
            color: perfectScore ? 'oklch(0.50 0.12 145)' : 'var(--ssz-text-primary)',
          },
          {
            val: String(vocabCount),
            label: t('statWords'),
            color: 'var(--ssz-text-primary)',
          },
          {
            val: t('xpEarned'),
            label: t('statXp'),
            color: 'var(--ssz-color-primary-500)',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-1 flex-col items-center rounded-[14px] border py-4 px-3 text-center"
            style={{
              background: 'var(--ssz-bg-surface)',
              borderColor: 'var(--ssz-border-default)',
              boxShadow: 'var(--ssz-shadow-xs)',
            }}
          >
            <span
              className="text-[26px] font-extrabold leading-none"
              style={{ color: stat.color, letterSpacing: '-0.03em' }}
            >
              {stat.val}
            </span>
            <span className="mt-1.5 text-[11.5px] font-semibold text-(--ssz-text-muted)">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex w-full flex-col gap-2.5">
        <a
          href={courseHref}
          className={cn(
            'flex items-center justify-center rounded-xl px-8 py-3',
            'text-[15px] font-bold text-white',
            'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            'transition-colors',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {t('backToCourse')}
        </a>
      </div>
    </div>
  );
}
