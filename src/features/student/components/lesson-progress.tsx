'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { useRouter } from '@/lib/i18n/navigation';

interface LessonProgressProps {
  position?: number;
  total?: number;
  containerTitle?: string;
}

export function LessonProgress({ position, total, containerTitle }: LessonProgressProps) {
  const t = useTranslations('Student');
  const router = useRouter();

  const percent =
    position !== undefined && total !== undefined && total > 0
      ? Math.round(((position - 1) / total) * 100)
      : 0;

  const hasContext = position !== undefined && total !== undefined;

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('player.exit')}
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {hasContext && (
          <>
            <ProgressBar value={percent} className="flex-1" height={6} />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {t('player.position', { current: position, total })}
            </span>
          </>
        )}

        {containerTitle && (
          <span className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:block">
            {containerTitle}
          </span>
        )}
      </div>
    </div>
  );
}
