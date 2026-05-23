'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, School, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { DataState } from '@/components/shared/data-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { BadgeProps } from '@/components/ui/badge';
import { useEnrollmentRequests } from '../api/use-enrollment-requests';
import type { EnrollmentRequest, EnrollmentStatus } from '../types';

const STATUS_BADGE: Record<EnrollmentStatus, BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

function RequestCard({ request }: { request: EnrollmentRequest }) {
  const t = useTranslations('Enrollment');

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {request.schoolType === 'tutor' ? (
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <School className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="font-medium truncate">{request.schoolName}</span>
        </div>
        <Badge variant={STATUS_BADGE[request.status]}>
          {t(`status.${request.status}`)}
        </Badge>
      </div>

      {request.message && (
        <div className="flex gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="line-clamp-3">{request.message}</p>
        </div>
      )}

      {request.selfAssessedLevel && (
        <p className="text-xs text-muted-foreground">
          {t('request.levelLabel')}: <span className="font-medium">{request.selfAssessedLevel}</span>
        </p>
      )}

      {request.reviewNote && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{t('reviewNote')}: </span>
          {request.reviewNote}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('sentOn', { date: new Date(request.createdAt).toLocaleDateString() })}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

type TabValue = 'all' | EnrollmentStatus;

export function RequestsList() {
  const t = useTranslations('Enrollment');
  const [tab, setTab] = useState<TabValue>('all');
  const { data, isLoading, error } = useEnrollmentRequests();

  const all = data?.items ?? [];
  const filtered = tab === 'all' ? all : all.filter((r) => r.status === tab);

  const counts: Record<TabValue, number> = {
    all: all.length,
    pending: all.filter((r) => r.status === 'pending').length,
    approved: all.filter((r) => r.status === 'approved').length,
    rejected: all.filter((r) => r.status === 'rejected').length,
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
      <TabsList className="mb-6">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <TabsTrigger key={s} value={s}>
            {t(`requests.tab.${s}`)}
            {counts[s] > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {counts[s]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
        <TabsContent key={s} value={s}>
          <DataState
            isLoading={isLoading}
            error={error ? { code: 'unknown' } : null}
            isEmpty={!isLoading && filtered.length === 0}
            loadingSlot={<ListSkeleton />}
            emptySlot={
              <div className="py-16 text-center">
                <p className="text-muted-foreground text-sm">{t('requests.empty')}</p>
              </div>
            }
          >
            <div className="space-y-3">
              {filtered.map((req) => (
                <RequestCard key={req.id} request={req} />
              ))}
            </div>
          </DataState>
        </TabsContent>
      ))}
    </Tabs>
  );
}
