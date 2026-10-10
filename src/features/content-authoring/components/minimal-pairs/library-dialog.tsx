'use client';

import { useTranslations } from 'next-intl';
import { Check, List } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { exerciseContrast, hasPairOf, libraryOf } from '@/lib/shared-kernel/minimal-pairs';

import { insertFromLibrary, type DocumentUpdate, type MinimalPairsDocument } from './edits';
import { NoAudioBadge, READING } from './parts';

export interface LibraryDialogProps {
  open: boolean;
  exercise: MinimalPairsDocument;
  onOpenChange: (open: boolean) => void;
  onChange: DocumentUpdate;
}

/**
 * «From the library» — the pairs the language pack offers for the exercise's contrast (plan 72
 * Q2-A, §7.2).
 *
 * The modal is the handoff's; the bank behind it is not built yet, so the pack holds words only
 * and every pair arrives without audio: the «opptak finnes» tick is drawn from the data and today
 * appears on none. A pair already in the set is shown and disabled, as in the prototype. Picking
 * one closes the modal and drops the empty pairs (`fromLib`).
 */
export function LibraryDialog({ open, exercise, onOpenChange, onChange }: LibraryDialogProps) {
  const t = useTranslations('Authoring.minimalPairs.library');
  const family = exerciseContrast(exercise);
  const pairs = libraryOf(exercise.language, exercise.contrastId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="size-4" aria-hidden />
            {t('title', { label: family?.label ?? exercise.contrastId })}
          </DialogTitle>
          <DialogDescription>{t('sub')}</DialogDescription>
        </DialogHeader>

        {pairs.length === 0 ? (
          <p className="m-0 text-sm text-(--ssz-text-muted)">{t('empty')}</p>
        ) : (
          <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
            {pairs.map((words) => {
              const already = hasPairOf(exercise, words);
              // The bank is not built (Q2-A): no pair has recordings to attach yet.
              const recorded = false;
              return (
                <li key={words.join('/')}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => {
                      onChange((current) => insertFromLibrary(current, words));
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-(--ssz-radius-sm) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-[11px] py-[9px] text-left text-sm enabled:hover:border-(--ssz-interactive-primary) enabled:hover:bg-(--ssz-color-primary-50) focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {words.map((word, i) => (
                      <span key={word} className="contents">
                        {i > 0 && <span className="text-(--ssz-text-muted)">/</span>}
                        <b style={READING}>{word}</b>
                      </span>
                    ))}
                    <span className="flex-1" />
                    {recorded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-(--ssz-color-success-50) px-[7px] py-0.5 text-[10px] tracking-wide text-(--ssz-color-success-700)">
                        <Check size={11} aria-hidden="true" />
                        {t('recorded')}
                      </span>
                    ) : (
                      <NoAudioBadge>{t('none')}</NoAudioBadge>
                    )}
                    {already && (
                      <span className="text-xs text-(--ssz-text-muted)">{t('already')}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
