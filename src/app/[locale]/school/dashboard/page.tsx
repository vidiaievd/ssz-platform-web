'use client';

import { useMySchools } from '@/features/school';
import { SchoolEmptyState } from '@/components/school/empty-state';

export default function SchoolDashboardPage() {
  const { data: schools, isLoading, isError, refetch } = useMySchools();

  if (isLoading || !schools) {
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

  if (schools.length === 0) {
    return <SchoolEmptyState />;
  }

  // Real dashboard — shows the first school (multi-school support is future scope)
  const school = schools[0]!;

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
