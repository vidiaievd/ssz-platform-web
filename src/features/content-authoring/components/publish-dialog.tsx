'use client';

import { useState, useTransition } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

import { publishContainerAction } from '../actions/publish-container';
import { authoringKeys } from '../api/keys';

interface PublishDialogProps {
  container: Container;
}

export function PublishDialog({ container }: PublishDialogProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');

  const isMatch = confirmTitle === container.title;

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmTitle('');
    setOpen(next);
  }

  function handleConfirm() {
    if (!isMatch || isPending) return;
    startTransition(async () => {
      const result = await publishContainerAction(container.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
      toast.success(t('publish.success'));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary" type="button">
          {t('publish.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('publish.title')}</DialogTitle>
          <DialogDescription>{t('publish.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <ul className="list-inside list-disc space-y-1 text-amber-800 dark:text-amber-200">
              <li>{t('publish.warningSlug')}</li>
              <li>{t('publish.warningDiscoverable')}</li>
              <li>{t('publish.warningEvent')}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm">
              {t('publish.confirmPrompt')}{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {container.title}
              </code>
            </p>
            <Input
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
              placeholder={container.title}
              className="font-mono"
              autoComplete="off"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {t('publish.cancel')}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!isMatch || isPending}
            loading={isPending}
            onClick={handleConfirm}
          >
            {t('publish.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
