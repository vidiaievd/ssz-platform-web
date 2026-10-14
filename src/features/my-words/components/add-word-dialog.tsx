'use client';

import { useEffect, useState } from 'react';
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

import { MyWordsError } from '../api/client';
import { useCaptureWord, useWordLookup } from '../api/hooks';
import type { WordCaptureSource } from '../types';

/** How long «Added» stays before the dialog closes by itself. */
const CLOSE_AFTER_MS = 900;

/**
 * «Add to my words» for a word met in a text (plan 75). What a course already knows comes
 * first — the dictionary form and a translation, which is then the one used. Otherwise the
 * student writes their own, or leaves it empty: the word is saved and waits for one.
 */
export function AddWordDialog({
  surfaceForm,
  source,
  onClose,
}: {
  surfaceForm: string;
  source: WordCaptureSource;
  onClose: () => void;
}) {
  const t = useTranslations('Learning.myWords');
  const translationLanguage = useLocale();
  const [translation, setTranslation] = useState('');

  const lookup = useWordLookup(
    { targetLanguage: source.targetLanguage, translationLanguage, form: surfaceForm },
    true,
  );
  const capture = useCaptureWord();

  useEffect(() => {
    if (!capture.isSuccess) return;
    const timer = setTimeout(onClose, CLOSE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [capture.isSuccess, onClose]);

  const existing = lookup.data?.entry ?? null;
  const catalog = lookup.data?.catalog ?? null;
  const catalogTranslation = catalog?.translation ?? null;
  const headword = existing?.word ?? catalog?.word ?? surfaceForm;
  const partOfSpeech = existing?.partOfSpeech ?? catalog?.partOfSpeech ?? null;
  const refused =
    capture.error instanceof MyWordsError && capture.error.status === 422 ? t('refused') : null;

  function save() {
    const own = translation.trim();
    capture.mutate({
      targetLanguage: source.targetLanguage,
      translationLanguage,
      surfaceForm,
      ...(own && !catalogTranslation ? { translation: own } : {}),
      ...(source.contextSentence ? { contextSentence: source.contextSentence } : {}),
      ...(source.variantId ? { sourceVariantId: source.variantId } : {}),
      ...(source.paragraphIndex !== null ? { sourceParagraph: source.paragraphIndex } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" lang={source.targetLanguage}>
            {headword}
            {partOfSpeech && (
              <span className="rounded-md bg-(--ssz-color-primary-50) px-2 py-0.5 text-xs font-semibold text-(--ssz-color-primary-600)">
                {partOfSpeech}
              </span>
            )}
          </DialogTitle>
          {headword.toLowerCase() !== surfaceForm.toLowerCase() && (
            <DialogDescription>{t('inText', { form: surfaceForm })}</DialogDescription>
          )}
        </DialogHeader>

        {source.contextSentence && (
          <p
            lang={source.targetLanguage}
            className="font-reading text-sm text-(--ssz-text-secondary) italic"
          >
            {source.contextSentence}
          </p>
        )}

        {capture.data ? (
          <div>
            <p className="text-base font-semibold">
              {capture.data.word.translation ?? t('waitingForTranslation')}
            </p>
            <p className="text-sm font-semibold text-(--ssz-color-success-600)">{t('added')}</p>
          </div>
        ) : lookup.isLoading ? (
          <p className="text-sm text-(--ssz-text-muted)">{t('looking')}</p>
        ) : existing ? (
          <div>
            <p className="text-base font-semibold">
              {existing.translation ?? t('waitingForTranslation')}
            </p>
            <p className="text-xs text-(--ssz-text-muted)">{t('alreadyAdded')}</p>
          </div>
        ) : catalogTranslation ? (
          <div>
            <p className="text-base font-semibold">{catalogTranslation}</p>
            <p className="text-xs text-(--ssz-text-muted)">{t('fromCourse')}</p>
          </div>
        ) : (
          <Input
            autoFocus
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !capture.isPending && !capture.isSuccess) save();
            }}
            placeholder={t('translationPlaceholder')}
            aria-label={t('translationPlaceholder')}
            disabled={capture.isPending || capture.isSuccess}
          />
        )}

        {capture.isError && (
          <p className="text-sm text-(--ssz-color-error-600)">{refused ?? t('saveError')}</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('close')}
          </Button>
          {!existing && !capture.isSuccess && (
            <Button onClick={save} disabled={lookup.isLoading || capture.isPending}>
              {t('save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
