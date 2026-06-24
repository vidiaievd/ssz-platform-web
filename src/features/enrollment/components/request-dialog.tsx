'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { School } from '@/features/discovery/types';
import { requestEnrollmentAction } from '../api/request-enrollment';

interface RequestDialogProps {
  school: School | null;
  open: boolean;
  onClose: () => void;
}

export function RequestDialog({ school, open, onClose }: RequestDialogProps) {
  const t = useTranslations('Enrollment');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function handleConfirm() {
    if (!school) return;
    startTransition(async () => {
      const result = await requestEnrollmentAction(school.id, {
        language: school.targetLanguages[0],
      });
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      toast.success(t('request.success', { name: school.name }));
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('request.title', { name: school?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('request.description')}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {t('request.cancel')}
          </Button>
          <Button type="button" variant="primary" loading={isPending} disabled={isPending} onClick={handleConfirm}>
            {t('request.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
