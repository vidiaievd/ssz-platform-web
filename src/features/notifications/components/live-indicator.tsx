'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface LiveIndicatorProps {
  connected: boolean;
}

export function LiveIndicator({ connected }: LiveIndicatorProps) {
  const t = useTranslations('Notifications');

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', connected ? 'bg-success-500' : 'bg-muted-foreground')}
      />
      {connected ? t('live') : t('reconnecting')}
    </span>
  );
}
