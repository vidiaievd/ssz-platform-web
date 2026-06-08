'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { bulkMessage } from '@/features/students/api/mutations';
import { bulkMessageSchema, type BulkMessageInput } from '@/features/students/schemas';

type Props = {
  open: boolean;
  onOpenChangeAction: (v: boolean) => void;
  schoolId: string;
  /** IDs of students in the current segment/selection */
  userIds: string[];
  audienceLabel?: string;
};

export function BulkMessageDialog({
  open,
  onOpenChangeAction,
  schoolId,
  userIds,
  audienceLabel,
}: Props) {
  const t = useTranslations('Students');
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<BulkMessageInput>({
      resolver: zodResolver(bulkMessageSchema),
    });

  function handleClose() {
    reset();
    onOpenChangeAction(false);
  }

  function onSubmit(data: BulkMessageInput) {
    startTransition(async () => {
      const result = await bulkMessage(schoolId, {
        subject: data.subject,
        body: data.body,
        userIds,
      });
      if (result.ok) {
        toast.success(t('bulkMessage.sent', { count: userIds.length }));
        handleClose();
      } else {
        toast.error(t('bulkMessage.failed'));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('bulkMessage.title')}</DialogTitle>
          <DialogDescription>
            {t('bulkMessage.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Audience preview */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('bulkMessage.audience')}:</span>
            <Badge variant="muted">
              {audienceLabel ?? t('bulkMessage.recipients', { count: userIds.length })}
            </Badge>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="bm-subject">{t('bulkMessage.subject')}</Label>
            <Input
              id="bm-subject"
              {...register('subject')}
              placeholder={t('bulkMessage.subjectPlaceholder')}
              aria-describedby={errors.subject ? 'bm-subject-error' : undefined}
            />
            {errors.subject && (
              <p id="bm-subject-error" className="text-xs text-destructive">
                {errors.subject.message}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="bm-body">{t('bulkMessage.body')}</Label>
            <Textarea
              id="bm-body"
              {...register('body')}
              placeholder={t('bulkMessage.bodyPlaceholder')}
              rows={6}
              aria-describedby={errors.body ? 'bm-body-error' : undefined}
            />
            {errors.body && (
              <p id="bm-body-error" className="text-xs text-destructive">
                {errors.body.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={userIds.length === 0 || isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              {t('bulkMessage.send', { count: userIds.length })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
