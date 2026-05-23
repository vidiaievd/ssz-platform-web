'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

const APP_STORE_URL = 'https://apps.apple.com/app/voxord';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.voxord';
const STORAGE_KEY = 'voxord-promo-dismissed';

export function VoxOrdPromo() {
  const t = useTranslations('Student.voxordPromo');
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="relative rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
      <button
        onClick={handleDismiss}
        aria-label={t('dismiss')}
        className="absolute right-3 top-3 rounded p-0.5 text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/40"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
            {t('title')}
          </p>
          <p className="text-xs text-violet-700 dark:text-violet-300">
            {t('description')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="ghost" size="sm" className="text-violet-700 hover:text-violet-900 dark:text-violet-300">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                {t('appStore')}
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-violet-700 hover:text-violet-900 dark:text-violet-300">
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                {t('playStore')}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
