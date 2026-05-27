'use client';

import { useMySchools, useSchool, useCreateWizardStore } from '@/features/school';
import { SchoolEmptyState } from '@/components/school/empty-state';

export default function SchoolDashboardPage() {
  const { data: schools, isLoading, isError, refetch } = useMySchools();

  // Fallback: if the /schools list endpoint returns empty (known backend issue
  // where GET /api/v1/schools may not filter by the authenticated user yet),
  // try fetching the school directly by the ID stored in the wizard store.
  const wizardSchoolId = useCreateWizardStore((s) => s.schoolId);
  const canTryFallback = !isLoading && !isError && schools?.length === 0 && Boolean(wizardSchoolId);
  const { data: fallbackSchool, isLoading: isFallbackLoading } = useSchool(
    canTryFallback ? (wizardSchoolId ?? '') : '',
  );

  if (isLoading || (canTryFallback && isFallbackLoading)) {
    return <SchoolEmptyState isLoading />;
  }

  if (isError) {
    return (
      <SchoolEmptyState
        error="Failed to load your schools. Please try again."
        onRetry={() => void refetch()}
      />
    );
  }

  const school = schools?.[0] ?? (canTryFallback ? fallbackSchool : null) ?? null;

  if (!school) {
    return <SchoolEmptyState />;
  }

  return (
    <main className="p-8">
      <h1 className="font-[Lora] text-3xl font-semibold text-(--ssz-text-primary)">
        {school.name}
      </h1>
      {school.description && (
        <p className="mt-2 text-(--ssz-text-secondary)">{school.description}</p>
      )}
      <p className="mt-6 text-sm text-(--ssz-text-muted)">
        Full dashboard metrics coming in a later step of Phase 18.
      </p>
    </main>
  );
}
