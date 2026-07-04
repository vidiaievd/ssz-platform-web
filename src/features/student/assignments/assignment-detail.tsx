'use client';

import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssignment } from '@/features/learning/api/use-assignments';

import { GradedRunner } from './graded-runner';
import { WrittenSubmission } from './written-submission';

/* ── Loading skeleton ────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-[840px] px-9 py-6 pb-16" aria-busy="true" aria-label="Loading assignment">
      <Skeleton className="mb-4 h-4 w-32 rounded" />
      <Skeleton className="h-[300px] w-full max-w-[560px] rounded-2xl" />
    </div>
  );
}

/* ── Error state ─────────────────────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Assignments.error');
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-20 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-[18px]"
        style={{ background: 'var(--ssz-color-error-50)' }}
      >
        <RefreshCw size={28} style={{ color: 'var(--ssz-color-error-500)' }} aria-hidden />
      </span>
      <p className="text-[17px] font-bold" style={{ color: 'var(--ssz-text-primary)' }}>{t('title')}</p>
      <p className="text-sm" style={{ color: 'var(--ssz-text-secondary)' }}>{t('body')}</p>
      <Button variant="outline" onClick={onRetry} className="mt-2">
        <RefreshCw size={14} aria-hidden />
        {t('retry')}
      </Button>
    </div>
  );
}

/* ── Detail shell ────────────────────────────────────────── */
interface AssignmentDetailProps {
  assignmentId: string;
}

export function AssignmentDetail({ assignmentId }: AssignmentDetailProps) {
  const t = useTranslations('Assignments');
  const locale = useLocale();
  const router = useRouter();

  const { data: assignment, isLoading, isError, refetch } = useAssignment(assignmentId);

  function handleExit() {
    router.push(`/${locale}/student/assignments`);
  }

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !assignment) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="mx-auto max-w-[840px] px-9 py-6 pb-16">
      {/* Back link */}
      <button
        type="button"
        onClick={handleExit}
        className="mb-[18px] inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1.5 text-[13.5px] font-semibold transition-colors"
        style={{ color: 'var(--ssz-text-secondary)', background: 'none', border: 'none' }}
      >
        <ChevronLeft size={17} aria-hidden />
        {t('backLink')}
      </button>

      {/* Body */}
      {assignment.mode === 'graded' ? (
        <GradedRunner assignment={assignment} onExit={handleExit} />
      ) : (
        <WrittenSubmission assignment={assignment} onExit={handleExit} />
      )}
    </div>
  );
}
