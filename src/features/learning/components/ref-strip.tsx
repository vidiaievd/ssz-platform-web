'use client';

import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface RefStripParagraph {
  native: string;
  translation?: string;
}

export interface RefStripProps {
  title: string;
  paragraphs: RefStripParagraph[];
  open: boolean;
  onToggle: () => void;
  className?: string;
}

export function RefStrip({ title, paragraphs, open, onToggle, className }: RefStripProps) {
  const t = useTranslations('Learning.refStrip');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border',
        'border-[var(--ssz-color-primary-200)] bg-[var(--ssz-color-primary-50)]',
        'dark:border-[var(--ssz-color-primary-800)] dark:bg-[oklch(0.20_0.025_168)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 px-3.5 py-2.5',
          'text-left text-[13px] font-bold text-[var(--ssz-color-primary-700)]',
          'dark:text-[var(--ssz-color-primary-300)]',
          'hover:bg-[var(--ssz-color-primary-100)] dark:hover:bg-[oklch(0.24_0.03_168)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ssz-border-focus)]',
          'transition-colors',
        )}
        style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
      >
        <BookOpen size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('reference')}</span>
        <em className="ml-0.5 truncate font-reading text-[13px] font-normal">{title}</em>
        <span className="ml-auto shrink-0" aria-hidden="true">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
          {paragraphs.map((p, i) => (
            <div key={i}>
              <p className="font-reading text-[13.5px] leading-relaxed text-(--ssz-text-primary)">
                {p.native}
              </p>
              {p.translation && (
                <p className="mt-0.5 text-xs italic leading-relaxed text-(--ssz-text-muted)">
                  {p.translation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
