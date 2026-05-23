'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { difficultyLevels } from '@/features/content/schemas';
import type { School } from '@/features/discovery/types';
import { requestEnrollmentAction } from '../api/request-enrollment';
import { enrollmentKeys } from '../api/keys';
import { enrollmentRequestSchema } from '../schemas/enrollment-request';
import type { EnrollmentRequestValues } from '../schemas/enrollment-request';

interface RequestDialogProps {
  school: School | null;
  open: boolean;
  onClose: () => void;
}

export function RequestDialog({ school, open, onClose }: RequestDialogProps) {
  const t = useTranslations('Enrollment');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EnrollmentRequestValues>({
    resolver: zodResolver(enrollmentRequestSchema),
    defaultValues: { message: '', selfAssessedLevel: undefined },
  });

  const levelValue = watch('selfAssessedLevel');

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      onClose();
    }
  }

  function onSubmit(values: EnrollmentRequestValues) {
    if (!school) return;
    startTransition(async () => {
      const result = await requestEnrollmentAction(school.id, values);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: enrollmentKeys.requests() });
      toast.success(t('request.success', { name: school.name }));
      reset();
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enrol-message">{t('request.messageLabel')}</Label>
            <Textarea
              id="enrol-message"
              placeholder={t('request.messagePlaceholder')}
              rows={4}
              maxLength={500}
              disabled={isPending}
              {...register('message')}
            />
            {errors.message && (
              <p className="text-destructive text-xs">{errors.message.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="enrol-level">{t('request.levelLabel')}</Label>
            <Select
              value={levelValue ?? 'none'}
              onValueChange={(v) =>
                setValue(
                  'selfAssessedLevel',
                  v === 'none' ? undefined : (v as EnrollmentRequestValues['selfAssessedLevel']),
                )
              }
              disabled={isPending}
            >
              <SelectTrigger id="enrol-level">
                <SelectValue placeholder={t('request.levelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('request.levelPlaceholder')}</SelectItem>
                {difficultyLevels.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" variant="primary" loading={isPending} disabled={isPending}>
              {t('request.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
