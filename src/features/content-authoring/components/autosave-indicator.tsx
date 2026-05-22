'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { AutosaveStatus } from '../hooks/use-autosave';

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  savedAt: Date | null;
}

export function AutosaveIndicator({ status, savedAt }: AutosaveIndicatorProps) {
  const t = useTranslations('Authoring');
  const [secsAgo, setSecsAgo] = useState(0);

  useEffect(() => {
    if (status !== 'saved' || !savedAt) return;
    const compute = () =>
      setSecsAgo(Math.round((Date.now() - savedAt.getTime()) / 1000));
    compute();
    const id = setInterval(compute, 5_000);
    return () => clearInterval(id);
  }, [status, savedAt]);

  if (status === 'saving') {
    return <span className="text-xs text-muted-foreground">{t('lessons.autosaving')}</span>;
  }
  if (status === 'error') {
    return <span className="text-xs text-destructive">{t('lessons.autosaveError')}</span>;
  }
  if (status === 'saved' && savedAt) {
    const label =
      secsAgo < 5
        ? t('lessons.autosaved')
        : t('lessons.autosavedAgo', { seconds: secsAgo });
    return <span className="text-xs text-green-600 dark:text-green-400">{label}</span>;
  }
  return null;
}
