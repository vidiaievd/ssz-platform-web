'use client';

import { useTranslations } from 'next-intl';

import { DataState } from '@/components/shared/data-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { useStudentSchools } from '../api/use-student-schools';
import { GroupAssignedBanner } from './group-assigned-banner';
import { SchoolStatusCard } from './school-status-card';
import { SchoolSummaryCard } from './school-summary-card';

function BandSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * "My schools" band — one card per school membership. Active memberships get
 * the rich summary card (group, next lesson, teachers); everything else
 * (pending/onboarding/placement-review/rejected/left) gets the honest status
 * card with the stepper. A membership with no group yet is locked with an
 * explanation, never an empty/blank course list (see plan 19, design doc §2.1).
 */
export function MySchoolsBand() {
  const t = useTranslations('Student.MySchools');
  const { data, isLoading, error, refetch } = useStudentSchools();

  return (
    <section aria-labelledby="my-schools-heading">
      <div className="mb-4">
        <h2 id="my-schools-heading" className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </div>

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && (data?.length ?? 0) === 0}
        onRetry={() => void refetch()}
        loadingSlot={<BandSkeleton />}
        emptySlot={
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
            <Button asChild variant="primary" size="sm" className="mt-4">
              <Link href="/student/discover">{t('browseDiscover')}</Link>
            </Button>
          </div>
        }
      >
        {data?.some((school) => school.status === 'active' && school.groupId && !school.groupAssignedSeenAt) && (
          <div className="mb-4 space-y-2">
            {data
              .filter((school) => school.status === 'active' && school.groupId && !school.groupAssignedSeenAt)
              .map((school) => (
                <GroupAssignedBanner key={school.membershipId} school={school} />
              ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((school) => (
            <div key={school.membershipId} id={`school-${school.schoolId}`}>
              {school.status === 'active' ? (
                <SchoolSummaryCard school={school} />
              ) : (
                <SchoolStatusCard school={school} />
              )}
            </div>
          ))}
        </div>
      </DataState>
    </section>
  );
}
