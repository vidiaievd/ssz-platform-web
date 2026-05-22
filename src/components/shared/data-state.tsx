'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppErrorCode } from '@/lib/errors';
import { ERROR_MESSAGE_KEYS } from '@/lib/errors';

export interface DataStateProps {
  isLoading?: boolean;
  error?: { code?: AppErrorCode; message?: string } | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingSlot?: ReactNode;
  emptySlot?: ReactNode;
  children: ReactNode;
}

function DefaultLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function DataState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  loadingSlot,
  emptySlot,
  children,
}: DataStateProps) {
  const t = useTranslations();

  if (isLoading) {
    return <>{loadingSlot ?? <DefaultLoadingSkeleton />}</>;
  }

  if (error) {
    const code = error.code ?? 'unknown';
    const messageKey = ERROR_MESSAGE_KEYS[code] ?? 'Errors.unknown';
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground text-sm">{t(messageKey)}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('Content.retry')}
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <>
        {emptySlot ?? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-muted-foreground text-sm">{t('Content.empty')}</p>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
