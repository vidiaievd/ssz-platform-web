'use client';

import { useTranslations } from 'next-intl';
import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { LayerSaveState } from './use-prosody-layers';

/** Where the marks of one passage are on their way to the server; nothing before the first edit. */
export function LayerSaveLine({
  state,
  onRetry,
}: {
  state: LayerSaveState | undefined;
  onRetry: () => void;
}) {
  const t = useTranslations('Authoring.prosodyEditor');
  if (state === undefined) return null;
  const line = (text: string, tone = 'text-(--ssz-text-muted)') => (
    <p role="status" className={`m-0 text-xs ${tone}`}>
      {text}
    </p>
  );
  switch (state.status) {
    case 'pending':
      return line(t('savePending'));
    case 'saving':
      return line(t('saving'));
    case 'saved':
      return line(t('saved'), 'text-(--ssz-color-success-700)');
    case 'conflict':
      return line(t('conflict'), 'text-(--ssz-color-warning-700)');
    case 'invalid':
      return line(t('invalid'), 'text-(--ssz-color-warning-700)');
    case 'failed':
      return (
        <p
          role="status"
          className="m-0 flex items-center gap-2 text-xs text-(--ssz-color-error-700)"
        >
          {t('saveFailed')}
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
            <RotateCw className="size-3.5" aria-hidden />
            {t('retry')}
          </Button>
        </p>
      );
  }
}
