'use client';

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ReaderSidebarItem, ReaderSidebarUnit } from '../types';

export interface LessonFooterNavProps {
  /** Flattened items of the active unit, in reading order. */
  items: ReaderSidebarItem[];
  activeItemId: string;
  /**
   * Sub-lesson following the open one. Used only on the unit's last item, where
   * the reader would otherwise dead-end and have to go back to course home.
   */
  nextUnit?: ReaderSidebarUnit | null;
  /** Fired when the learner activates the "Next" link (e.g. to mark the current item complete). */
  onNext?: () => void;
  className?: string;
}

export function LessonFooterNav({
  items,
  activeItemId,
  nextUnit,
  onNext,
  className,
}: LessonFooterNavProps) {
  const t = useTranslations('Learning.reader.footerNav');
  const tContent = useTranslations('Content.materialType');

  const idx = items.findIndex((i) => i.id === activeItemId);
  const prev = idx > 0 ? items[idx - 1] : null;
  const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;
  const nextLocked = next?.status === 'locked';
  /* Last item of the unit: hand over to the next sub-lesson instead of ending
     the road. A locked one still shows the lock message below. */
  const onward = !next && idx >= 0 ? nextUnit : null;

  return (
    <div
      className={cn(
        // Not sticky: the shell keeps this outside the scroll container, so the
        // bar is a real sibling of the scrollport rather than the last thing in
        // it. Sticky worked only once the reader had scrolled far enough for
        // the element to enter the scrollport at all.
        'shrink-0 flex items-center justify-between gap-3 border-t border-(--ssz-border-default) bg-surface px-6 py-3',
        className,
      )}
    >
      {prev ? (
        <Link
          href={prev.href}
          className="flex max-w-[40%] items-center gap-2 text-[13px] font-semibold text-secondary-foreground no-underline"
        >
          <ChevronLeft size={16} className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t('previous')}
            </span>
            <span className="block truncate">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      {next ? (
        nextLocked ? (
          <LockedNotice label={t('unlocksAfterThis')} />
        ) : (
          <NextLink
            href={next.href}
            eyebrow={t('next', { type: tContent(next.kind) })}
            title={next.title}
            onClick={onNext}
          />
        )
      ) : onward ? (
        onward.status === 'locked' ? (
          <LockedNotice label={t('unlocksAfterThis')} />
        ) : (
          <NextLink
            href={onward.href}
            eyebrow={t('nextUnit')}
            title={onward.title}
            onClick={onNext}
          />
        )
      ) : null}
    </div>
  );
}

function LockedNotice({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
      <Lock size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

function NextLink({
  href,
  eyebrow,
  title,
  onClick,
}: {
  href: string;
  eyebrow: string;
  title: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex max-w-[55%] items-center gap-2.5 rounded-xl bg-(--ssz-bg-brand-solid) px-5.5 py-2.75 text-[14.5px] font-bold text-(--ssz-text-on-brand) no-underline shadow-lg shadow-primary-500/30"
    >
      <span className="min-w-0 text-right">
        {/*
          Full opacity, not white/85: dimming a 10.5px label on the brand
          fill drops it to 2.94:1. The size and letter-spacing already
          separate it from the title below.
        */}
        <span className="block text-[10.5px] font-semibold tracking-wide uppercase">{eyebrow}</span>
        <span className="block truncate">{title}</span>
      </span>
      <ChevronRight size={17} className="shrink-0" />
    </Link>
  );
}
