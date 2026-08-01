'use client';

import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { VocabularyForm, VocabularyParadigm } from '@/features/content/types';
import { cn } from '@/lib/utils';

import { WordParadigmTable } from './word-paradigm-table';

export interface WordFormsProps {
  forms: VocabularyForm[];
  /**
   * Grid view of the same forms. When the item has one the drawer holds the
   * bøyning table; `forms` stays the fallback for items whose author-entered
   * labels do not map onto a paradigm's cells.
   */
  paradigm?: VocabularyParadigm;
  /** The form met in the text — highlighted in the list. */
  highlightValue?: string;
  /** 'drawer' — as in the vocabulary card; 'compact' — for the glossary popover. */
  density?: 'drawer' | 'compact';
  defaultOpen?: boolean;
  className?: string;
}

/**
 * The collapsible "Alle former" list of inflected forms. Shared by the
 * vocabulary flip card and the in-text glossary popover, so the same word
 * reads the same way wherever the learner meets it.
 */
export function WordForms({
  forms,
  paradigm,
  highlightValue,
  density = 'drawer',
  defaultOpen = false,
  className,
}: WordFormsProps) {
  const t = useTranslations('Learning.reader.vocab');
  const [open, setOpen] = useState(defaultOpen);

  if (forms.length === 0 && !paradigm) return null;

  const compact = density === 'compact';
  const normalizedHighlight = highlightValue?.toLocaleLowerCase();

  return (
    <div className={cn(compact ? 'mt-1.5' : 'mt-2', className)}>
      <button
        type="button"
        onClick={() => setOpen((f) => !f)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border-[1.5px] border-(--ssz-border-default)',
          'font-semibold text-(--ssz-text-secondary)',
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
          open ? 'bg-subtle' : 'bg-transparent',
        )}
      >
        <Layers size={compact ? 12 : 14} className="text-(--ssz-color-primary-600)" aria-hidden="true" />
        {t('allForms')}
        <span className="ml-auto flex">
          {open ? (
            <ChevronDown size={compact ? 12 : 14} className="text-(--ssz-text-muted)" aria-hidden="true" />
          ) : (
            <ChevronRight size={compact ? 12 : 14} className="text-(--ssz-text-muted)" aria-hidden="true" />
          )}
        </span>
      </button>
      {open && paradigm && (
        <div className={cn('overflow-x-auto', compact ? 'mt-1' : 'mt-1.5')}>
          <WordParadigmTable paradigm={paradigm} highlightValue={highlightValue} />
        </div>
      )}
      {open && !paradigm && (
        <div
          className={cn(
            'overflow-hidden rounded-md border border-(--ssz-border-default)',
            compact ? 'mt-1' : 'mt-1.5',
          )}
        >
          {forms.map((form, i) => {
            const highlighted =
              !!normalizedHighlight && form.value.toLocaleLowerCase() === normalizedHighlight;
            return (
              <div
                key={form.label}
                data-highlighted={highlighted || undefined}
                className={cn(
                  'flex items-baseline gap-2.5',
                  compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2',
                  highlighted
                    ? 'bg-(--ssz-color-primary-50)'
                    : i % 2
                      ? 'bg-(--ssz-bg-base)'
                      : 'bg-surface',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 font-semibold text-(--ssz-text-muted)',
                    compact ? 'min-w-24 text-[10.5px]' : 'min-w-30 text-[11px]',
                  )}
                >
                  {form.label}
                </span>
                <span
                  className={cn(
                    'font-reading text-(--ssz-text-primary)',
                    compact ? 'text-[13.5px]' : 'text-[15px]',
                    highlighted ? 'font-bold' : 'font-medium',
                  )}
                >
                  {form.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
