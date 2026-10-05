'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  canAddRow,
  entriesFor,
  IT_MAX_ROWS,
  lemmaOf,
  packOf,
  paradigmOf,
  slotsInPlay,
  suggestedForm,
  type DictionaryEntry,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

import { useCourseDictionary } from '../../api/use-course-dictionary';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface DictionaryPickerProps {
  exerciseId: string;
  exercise: InflectionTableContent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: DictionaryEntry) => void;
}

/**
 * «Add from the course dictionary» (plan 69 §7.3): the course's words of the paradigm's part
 * of speech, with the module that introduces each, searched on the client.
 *
 * Pulled on request and never automatically (DECISIONS §3); the forms shown are what the pack
 * would suggest for the slots in play. The dialog stays open while rows are added — a table is
 * built from several words. A word already in the table is shown ticked and cannot be added
 * twice; at ten rows every entry is disabled and the dialog says why (IT-B6).
 */
export function DictionaryPicker({
  exerciseId,
  exercise,
  open,
  onOpenChange,
  onAdd,
}: DictionaryPickerProps) {
  const t = useTranslations('Authoring.inflectionTable.picker');
  const locale = useLocale();
  const [query, setQuery] = useState('');

  const pack = packOf(exercise);
  const paradigm = paradigmOf(exercise);
  const dictionary = useCourseDictionary(exerciseId, paradigm?.pos ?? '', locale, open);

  if (!pack || !paradigm) return null;

  const taken = new Set(exercise.rows.map((r) => r.dictId));
  const full = !canAddRow(exercise);
  const slots = slotsInPlay(exercise);
  const list = entriesFor(dictionary.data ?? [], paradigm, query);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t.rich('hint', { b: (chunks) => <b className="font-semibold">{chunks}</b> })}
          </DialogDescription>
        </DialogHeader>

        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {full && (
          <p role="status" className="m-0 text-xs text-(--ssz-color-warning-700)">
            {t('ceiling', { max: IT_MAX_ROWS })}
          </p>
        )}

        <div className="max-h-[50vh] overflow-y-auto rounded-(--ssz-radius-sm) border border-(--ssz-border-default)">
          {dictionary.isPending && (
            <p className="m-0 p-3 text-sm text-(--ssz-text-muted)">{t('loading')}</p>
          )}
          {dictionary.isError && (
            <p role="alert" className="m-0 p-3 text-sm text-(--ssz-color-error-700)">
              {t('failed')}
            </p>
          )}
          {dictionary.isSuccess && list.length === 0 && (
            <p className="m-0 p-3 text-sm text-(--ssz-text-muted)">{t('none')}</p>
          )}
          {list.map((entry) => {
            const used = taken.has(entry.id);
            const lemma = lemmaOf(entry, pack, paradigm);
            const forms = slots
              .map((slot) => suggestedForm(entry, pack, slot))
              .filter((form) => form !== '')
              .join(' – ');
            return (
              <button
                key={entry.id}
                type="button"
                disabled={used || full}
                aria-label={used ? `${lemma} — ${t('taken')}` : t('add', { lemma })}
                onClick={() => onAdd(entry)}
                className={[
                  'flex w-full items-center gap-3 border-b border-(--ssz-border-default) px-3 py-2 text-left last:border-b-0',
                  'hover:bg-(--ssz-color-primary-50) focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none',
                  'disabled:opacity-45 disabled:hover:bg-transparent',
                ].join(' ')}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-base font-semibold" style={READING} lang={exercise.language}>
                    {lemma}
                  </b>
                  <span className="text-[11px] text-(--ssz-text-muted)">
                    {[entry.gloss, entry.unit].filter((part) => part !== '').join(' · ')}
                  </span>
                </span>
                <span className="font-mono text-xs text-(--ssz-text-secondary)">{forms}</span>
                {used ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Plus size={15} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
