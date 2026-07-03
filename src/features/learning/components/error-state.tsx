import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  const t = useTranslations('Learning.errorState');

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 py-16 text-center', className)}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--ssz-color-error-50)' }}
        aria-hidden="true"
      >
        <AlertCircle size={24} className="text-[var(--ssz-color-error-500)]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--ssz-text-primary)">
          {title ?? t('default')}
        </p>
        {description && (
          <p className="mx-auto max-w-xs text-sm text-(--ssz-text-muted)">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
