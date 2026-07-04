'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { Field } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { School } from '@/features/discovery/types';
import { requestEnrollmentAction } from '../api/request-enrollment';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

interface RequestDialogProps {
  school: School | null;
  open: boolean;
  onClose: () => void;
}

export function RequestDialog({ school, open, onClose }: RequestDialogProps) {
  const t = useTranslations('Enrollment');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();
  const [language, setLanguage] = useState<string>('');
  const [level, setLevel] = useState<string>('');

  useEffect(() => {
    void (async () => {
      if (open && school) {
        setLanguage(school.targetLanguages[0] ?? '');
        setLevel('');
      }
    })();
  }, [open, school]);

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function handleConfirm() {
    if (!school) return;
    startTransition(async () => {
      const result = await requestEnrollmentAction(school.id, {
        language: language || undefined,
        selfReportedLevel: level ? (level as (typeof CEFR_LEVELS)[number]) : undefined,
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('request.languageLabel')} htmlFor="enrollment-request-language">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="enrollment-request-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(school?.targetLanguages ?? []).map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('request.levelLabel')} htmlFor="enrollment-request-level">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger id="enrollment-request-level" className="w-full">
                <SelectValue placeholder={t('request.levelUnknown')} />
              </SelectTrigger>
              <SelectContent>
                {CEFR_LEVELS.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {lvl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

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
