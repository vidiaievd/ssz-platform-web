'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

interface LessonNavigationProps {
  prevHref?: string;
  nextHref?: string;
  onComplete: () => void;
  isCompleted: boolean;
  isPending: boolean;
}

export function LessonNavigation({
  prevHref,
  nextHref,
  onComplete,
  isCompleted,
  isPending,
}: LessonNavigationProps) {
  const t = useTranslations('Student');

  return (
    <div className="mt-12 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-4">
        {prevHref ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={prevHref}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('player.prev')}
            </Link>
          </Button>
        ) : (
          <div />
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={onComplete}
          loading={isPending}
          disabled={isPending || isCompleted}
          className="gap-1.5"
        >
          {isCompleted ? (
            <>
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              {t('player.completed')}
            </>
          ) : nextHref ? (
            <>
              {t('player.completeAndNext')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              {t('player.markComplete')}
            </>
          )}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t('player.keyboardHint')}
      </p>
    </div>
  );
}
