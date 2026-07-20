'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSrsDue } from '../../api/use-srs-due';
import { useSrsSessionStore } from '../../stores/srs-session-store';
import { SrsEntry } from './entry';
import { SrsSession } from './session';
import { SrsSettingsDialog } from './settings-dialog';
import { SessionSummary } from './summary';

/* ── Loading skeleton ───────────────────────────────────────────────── */
function SrsLoadingSkeleton() {
  return (
    <div
      className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-4"
      aria-busy="true"
      aria-label="Loading…"
    >
      <div className="w-full max-w-[34rem] space-y-6">
        <Skeleton className="mx-auto h-8 w-36 rounded-full" />
        <Skeleton className="mx-auto h-16 w-24" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <Skeleton className="h-11 w-full rounded-[var(--ssz-radius-md)]" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-[var(--ssz-radius-md)]" />
          <Skeleton className="h-10 flex-1 rounded-[var(--ssz-radius-md)]" />
        </div>
      </div>
    </div>
  );
}

/* ── Error state ────────────────────────────────────────────────────── */
interface SrsErrorProps {
  onRetry: () => void;
}
function SrsError({ onRetry }: SrsErrorProps) {
  const t = useTranslations('Srs');
  return (
    <div
      className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center gap-4 px-4 text-center"
      role="alert"
    >
      <AlertTriangle className="h-10 w-10 text-[var(--ssz-color-error-500)]" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold text-[var(--ssz-text-primary)]">{t('error.title')}</p>
        <p className="text-sm text-[var(--ssz-text-secondary)]">{t('error.body')}</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
        {t('error.retry')}
      </Button>
    </div>
  );
}

/* ── Main SRS page ──────────────────────────────────────────────────── */
export function SrsPage() {
  const { data, isLoading, isError, refetch } = useSrsDue();
  const { phase, seed, startSession } = useSrsSessionStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* Seed the store once data arrives */
  useEffect(() => {
    if (!data) return;
    seed({
      cards: data.cards,
      dailyLimit: data.dailyLimit,
    });
    // Only re-seed when the due data changes (window focus refetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) return <SrsLoadingSkeleton />;
  if (isError || !data) return <SrsError onRetry={() => void refetch()} />;

  /* Session phase — full-screen, no padding */
  if (phase === 'session') {
    return <SrsSession />;
  }

  /* Entry and Summary share a centered column layout */
  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[34rem]">
        {phase === 'entry' && (
          <SrsEntry
            dueCount={data.dueCount}
            reviewedToday={data.reviewedToday}
            dailyLimit={data.dailyLimit}
            onStart={() => startSession()}
            onSettings={() => setSettingsOpen(true)}
          />
        )}

        {phase === 'summary' && <SessionSummary />}
      </div>

      <SrsSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
