'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { useWordCapture } from './word-capture-provider';

/** «Add to my words» under a glossary card. Renders nothing outside a capturing reader. */
export function AddToMyWordsButton({
  surfaceForm,
  contextSentence,
  className,
}: {
  surfaceForm: string;
  contextSentence: string | null;
  className?: string;
}) {
  const t = useTranslations('Learning.myWords');
  const capture = useWordCapture();
  if (!capture) return null;

  return (
    <button
      type="button"
      onClick={() => capture.open({ surfaceForm, contextSentence, paragraphIndex: null })}
      className={cn('text-left text-xs font-semibold text-(--ssz-color-primary-600)', className)}
    >
      {t('add')}
    </button>
  );
}
