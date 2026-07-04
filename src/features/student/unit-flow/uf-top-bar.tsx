'use client';

import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { UnitStepper } from '@/features/learning';
import type { UnitPhase } from '@/features/learning';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

export interface UFTopBarProps {
  phase: UnitPhase;
  unitNumber: number;
  courseHref: string;
  className?: string;
}

export function UFTopBar({ phase, unitNumber, courseHref, className }: UFTopBarProps) {
  const t = useTranslations('Learning.unitFlow');

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-[72px] items-start border-b px-5 pt-3.5',
        'border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)]',
        className,
      )}
    >
      {/* Exit link — left */}
      <Link
        href={courseHref}
        className={cn(
          'flex shrink-0 items-center gap-1 pt-0.5',
          'text-[13px] font-bold text-[var(--ssz-text-muted)]',
          'transition-colors hover:text-[var(--ssz-text-primary)]',
        )}
        style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
      >
        <ChevronLeft size={15} aria-hidden="true" />
        {t('exitLabel')}
      </Link>

      {/* Unit stepper — center */}
      <UnitStepper phase={phase} />

      {/* Unit label — right */}
      <span
        className="shrink-0 pt-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ssz-text-muted)]"
        aria-hidden="true"
      >
        {t('unitLabel', { n: unitNumber })}
      </span>
    </header>
  );
}
