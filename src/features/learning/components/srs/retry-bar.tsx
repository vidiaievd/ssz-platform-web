import { RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { ReviewRating } from '../../types';

function ratingLabel(
  rating: ReviewRating,
  t: ReturnType<typeof useTranslations<'Srs.rating'>>,
): string {
  if (rating === 1) return t('again');
  if (rating === 2) return t('hard');
  if (rating === 3) return t('good');
  return t('easy');
}

interface RetryBarProps {
  rating: ReviewRating;
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function RetryBar({ rating, message, onRetry, onDismiss }: RetryBarProps) {
  const tRating = useTranslations('Srs.rating');
  const tErr = useTranslations('Srs.error');

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-[var(--ssz-radius-md)] border border-[var(--ssz-color-error-300)] bg-[var(--ssz-color-error-50)] px-4 py-3 text-sm text-[var(--ssz-color-error-700)]"
    >
      <p className="flex-1">
        {message}{' '}
        <span className="font-semibold">({ratingLabel(rating, tRating)})</span>
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="border-[var(--ssz-color-error-300)] text-[var(--ssz-color-error-700)] hover:bg-[var(--ssz-color-error-100)]"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {tErr('retry')}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="h-7 w-7 text-[var(--ssz-color-error-700)] hover:bg-[var(--ssz-color-error-100)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
