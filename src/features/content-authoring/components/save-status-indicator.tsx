'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { SaveStatus } from '../hooks/use-unsaved-changes';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  savedAt: Date | null;
}

export function SaveStatusIndicator({ status, savedAt }: SaveStatusIndicatorProps) {
  const t = useTranslations('Authoring');
  const [secsAgo, setSecsAgo] = useState(0);

  useEffect(() => {
    if (status !== 'saved' || !savedAt) return;
    const compute = () => setSecsAgo(Math.round((Date.now() - savedAt.getTime()) / 1000));
    compute();
    const id = setInterval(compute, 5_000);
    return () => clearInterval(id);
  }, [status, savedAt]);

  if (status === 'dirty') {
    return <span className="text-xs text-warning-700">{t('lessons.unsavedChanges')}</span>;
  }
  if (status === 'saving') {
    return <span className="text-xs text-muted-foreground">{t('lessons.saving')}</span>;
  }
  if (status === 'error') {
    return <span className="text-xs text-destructive">{t('lessons.saveFailed')}</span>;
  }
  if (status === 'saved' && savedAt) {
    const label = secsAgo < 5 ? t('lessons.saved') : t('lessons.savedAgo', { seconds: secsAgo });
    return <span className="text-xs text-green-600 dark:text-green-400">{label}</span>;
  }
  return null;
}
