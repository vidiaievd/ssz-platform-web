'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { discardDraftContainerAction } from '../actions/discard-draft-container';
import { authoringKeys } from '../api/keys';

export interface DiscardDraftDialogProps {
  containerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DiscardDraftDialog({
  containerId,
  open,
  onOpenChange,
  onSuccess,
}: DiscardDraftDialogProps) {
  const t = useTranslations('Authoring.discard');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await discardDraftContainerAction(containerId);
      if (!result.ok) {
        toast.error(t('error'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.versions(containerId) });
      await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
      toast.success(t('success'));
      onOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
            </span>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{t('body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isPending}
            loading={isPending}
          >
            {isPending ? t('discarding') : t('confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
