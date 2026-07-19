'use client';

import { useMemo, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/config';

import { bulkCreateVocabularyItemsAction } from '../actions/vocabulary';
import { parseVocabularyBulkPaste } from '../lib/parse-vocabulary-bulk-paste';
import { authoringKeys } from '../api/keys';

interface VocabularyBulkPasteDialogProps {
  listId: string;
  containerId: string;
}

export function VocabularyBulkPasteDialog({ listId, containerId }: VocabularyBulkPasteDialogProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [languageCode, setLanguageCode] = useState<string>('en');
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => parseVocabularyBulkPaste(text), [text]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setText('');
  }

  function handleSubmit() {
    if (rows.length === 0) return;
    startTransition(async () => {
      const result = await bulkCreateVocabularyItemsAction(listId, containerId, rows, languageCode);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.vocabularyItemsAll(listId) });
      toast.success(t('vocabulary.bulkPasteSuccess', { count: result.value.created }));
      setText('');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <Upload className="mr-1.5 h-4 w-4" />
          {t('vocabulary.bulkPaste')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('vocabulary.bulkPasteDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('vocabulary.bulkPasteHint')}</p>
          <Textarea
            rows={8}
            placeholder={t('vocabulary.bulkPastePlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isPending}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('vocabulary.bulkPasteLanguage')}</span>
              <Select value={languageCode} onValueChange={setLanguageCode} disabled={isPending}>
                <SelectTrigger size="sm" className="w-36" aria-label={t('vocabulary.bulkPasteLanguage')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {LOCALE_LABELS[locale]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground">
              {t('vocabulary.bulkPasteRowCount', { count: rows.length })}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {t('lessons.deleteCancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={rows.length === 0} loading={isPending}>
            {t('vocabulary.bulkPasteSubmit', { count: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
