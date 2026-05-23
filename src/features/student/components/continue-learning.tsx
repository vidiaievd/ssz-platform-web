'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, Globe, GraduationCap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from '@/components/shared/data-state';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { useContinueLearning } from '../api/use-continue-learning';
import type { ContainerProgress } from '../types';

function ContainerProgressCard({ item }: { item: ContainerProgress }) {
  const t = useTranslations('Student');
  const isStarted = item.completedItems > 0;
  const resumeHref = item.nextItemId
    ? `/student/enrolled/lessons/${item.nextItemId}`
    : `/student/enrolled`;

  return (
    <Card noPadding className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <ProgressRing
            value={item.progressPercent}
            size={52}
            strokeWidth={4}
            showLabel
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug">{item.containerTitle}</CardTitle>
            <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
              {item.targetLanguage && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" aria-hidden="true" />
                  {item.targetLanguage.toUpperCase()}
                </span>
              )}
              {item.level && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" aria-hidden="true" />
                  {item.level}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody className="flex-1 py-2 space-y-2">
        <ProgressBar value={item.progressPercent} showLabel height={6} />
        <p className="text-muted-foreground text-xs">
          {t('continueLearning.progress', {
            completed: item.completedItems,
            total: item.totalItems,
          })}
        </p>
        {item.nextItemTitle && (
          <div className="flex items-center gap-1.5 text-xs">
            <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground truncate">{item.nextItemTitle}</span>
          </div>
        )}
      </CardBody>

      <CardFooter>
        <Button asChild variant="primary" size="sm" className="w-full">
          <Link href={resumeHref}>
            {isStarted ? t('continueLearning.resume') : t('continueLearning.start')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-52 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ContinueLearning() {
  const t = useTranslations('Student');
  const { data, isLoading, error } = useContinueLearning();

  return (
    <section aria-labelledby="continue-learning-heading">
      <div className="mb-4">
        <h2 id="continue-learning-heading" className="text-lg font-semibold">
          {t('continueLearning.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('continueLearning.subtitle')}</p>
      </div>

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && (data?.length ?? 0) === 0}
        loadingSlot={<GridSkeleton />}
        emptySlot={
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">{t('continueLearning.empty')}</p>
            <Button asChild variant="primary" size="sm" className="mt-4">
              <Link href="/student/enrolled">{t('continueLearning.browseEnrolled')}</Link>
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((item) => (
            <ContainerProgressCard key={item.id} item={item} />
          ))}
        </div>
      </DataState>
    </section>
  );
}
