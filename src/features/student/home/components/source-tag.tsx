'use client';

import { BookOpen, Bolt, Layers, User, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type CourseSource = 'school' | 'self' | 'free' | 'paid';

type Tone = 'info' | 'muted' | 'primary' | 'amber';

const SOURCE_META: Record<CourseSource, { icon: LucideIcon; tone: Tone }> = {
  school: { icon: Layers, tone: 'info' },
  self: { icon: User, tone: 'muted' },
  free: { icon: BookOpen, tone: 'primary' },
  paid: { icon: Bolt, tone: 'amber' },
};

const TONE_CLASSES: Record<Tone, string> = {
  info: 'bg-[oklch(0.91_0.055_235)] text-[oklch(0.40_0.10_235)]',
  muted: 'bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)',
  primary: 'bg-[oklch(0.93_0.05_168)] text-[oklch(0.40_0.09_168)]',
  amber: 'bg-[oklch(0.95_0.045_82)] text-[oklch(0.44_0.09_82)]',
};

export interface SourceTagProps {
  source: CourseSource;
  className?: string;
}

/** Small pill identifying where a course comes from: school / self-study / free / subscription. */
export function SourceTag({ source, className }: SourceTagProps) {
  const t = useTranslations('Student.homeCards.sourceTag');
  const { icon: Icon, tone } = SOURCE_META[source];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.75 text-[11px] font-bold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon size={11} aria-hidden="true" />
      {t(source)}
    </span>
  );
}
