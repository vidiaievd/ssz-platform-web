'use client';

import { Plus, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isAlreadyAField,
  type InformationTransferContent,
  type ScanHit,
} from '@/lib/shared-kernel/information-transfer';

import { READING } from '../minimal-pairs/parts';
import { useTypeLabel } from './issue-copy';

export interface ScanDialogProps {
  open: boolean;
  exercise: InformationTransferContent;
  hits: readonly ScanHit[];
  onOpenChange: (open: boolean) => void;
  /** The fact the author chose. The dialog closes after it. */
  onInsert: (hit: ScanHit) => void;
}

/**
 * «Facts found in the source» (plan 73 §7.3): the times, dates, amounts and phone numbers the
 * builder can see in the text or the transcript. Inserting one makes a field with the type
 * and the expected value already set — the label and the explanation stay the author's.
 */
export function ScanDialog({ open, exercise, hits, onOpenChange, onInsert }: ScanDialogProps) {
  const t = useTranslations('Authoring.informationTransfer.step2.scan');
  const typeLabel = useTypeLabel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4" aria-hidden />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {exercise.sourceKind === 'audio' ? t('subTranscript') : t('subText')}
          </DialogDescription>
        </DialogHeader>

        <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
          {hits.map((hit) => {
            const already = isAlreadyAField(exercise, hit);
            return (
              <li key={`${hit.type}|${hit.raw}`}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => onInsert(hit)}
                  className="flex w-full items-center gap-2.5 rounded-(--ssz-radius-sm) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-[11px] py-[9px] text-left text-sm enabled:hover:border-(--ssz-interactive-primary) enabled:hover:bg-(--ssz-color-primary-50) focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="rounded-[4px] bg-(--ssz-bg-subtle) px-[7px] py-0.5 font-mono text-[10px] tracking-wide text-(--ssz-text-secondary) uppercase">
                    {typeLabel(hit.type)}
                  </span>
                  <b style={READING}>{hit.raw}</b>
                  <span className="flex-1" />
                  {already ? (
                    <span className="text-xs text-(--ssz-text-muted)">{t('already')}</span>
                  ) : (
                    <Plus size={14} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
