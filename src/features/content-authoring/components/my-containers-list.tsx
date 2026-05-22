'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Globe, GraduationCap, BookOpen, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/components/shared/data-state';
import { Link } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

import type { ContainerStatus } from '../types';
import { useMyContainers } from '../api/use-my-containers';

type StatusTab = 'all' | ContainerStatus;

function ContainerStatusBadge({ isPublished }: { isPublished: boolean }) {
  const t = useTranslations('Authoring');
  return (
    <Badge variant={isPublished ? 'success' : 'muted'}>
      {t(isPublished ? 'status.published' : 'status.draft')}
    </Badge>
  );
}

function ContainerRow({ container }: { container: Container }) {
  const t = useTranslations('Authoring');
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-[var(--ssz-bg-surface)] p-4 transition-shadow hover:shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{container.title}</span>
          <ContainerStatusBadge isPublished={container.isPublished} />
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {t(`types.${container.type}`)}
          </span>
          {container.targetLanguage && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {container.targetLanguage.toUpperCase()}
            </span>
          )}
          {container.level && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              {container.level}
            </span>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/school/content/${container.id}`}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {t('actions.edit')}
        </Link>
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function MyContainersList() {
  const t = useTranslations('Authoring');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const filters = statusTab !== 'all' ? { status: statusTab as ContainerStatus } : undefined;
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMyContainers(filters);

  const containers = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
          <TabsList>
            <TabsTrigger value="all">{t('filters.all')}</TabsTrigger>
            <TabsTrigger value="draft">{t('filters.draft')}</TabsTrigger>
            <TabsTrigger value="published">{t('filters.published')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button asChild size="sm">
          <Link href="/school/content/new">
            <Plus className="mr-1 h-4 w-4" />
            {t('actions.newContainer')}
          </Link>
        </Button>
      </div>

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && !error && containers.length === 0}
        loadingSlot={<ListSkeleton />}
        emptySlot={
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground text-sm">{t('empty.containers')}</p>
            <Button asChild size="sm">
              <Link href="/school/content/new">
                <Plus className="mr-1 h-4 w-4" />
                {t('actions.newContainer')}
              </Link>
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {containers.map((container) => (
            <ContainerRow key={container.id} container={container} />
          ))}
        </div>
        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('actions.loadMore')}
            </Button>
          </div>
        )}
      </DataState>
    </div>
  );
}
