'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useSchool } from '@/features/school';
import { Skeleton } from '@/components/ui/skeleton';

export default function SchoolDashboardPage() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { data: school, isLoading } = useSchool(schoolSlug);
  const t = useTranslations('School');

  if (isLoading) {
    return (
      <main className="p-8 space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </main>
    );
  }

  if (!school) {
    return (
      <main className="p-8">
        <p className="text-(--ssz-text-secondary)">{t('dashboard.notFound')}</p>
      </main>
    );
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
        {t('dashboard.placeholder')}
      </p>
    </main>
  );
}
