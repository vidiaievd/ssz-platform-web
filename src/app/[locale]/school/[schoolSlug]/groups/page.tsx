import { AlertCircle } from 'lucide-react';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getGroups } from '@/features/groups/api/queries';
import { GroupsList } from '@/features/groups/components/groups-list';
import type { Segment, SortKey } from '@/features/groups/lib/filter-groups';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ q?: string; segment?: string; sort?: string }>;
};

export default async function GroupsPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { q, segment, sort } = await searchParams;

  const school = await getSchoolBySlug(schoolSlug);

  if (!school) {
    return (
      <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto">
        <p className="text-sm text-(--ssz-text-muted)">School not found.</p>
      </main>
    );
  }

  const { groups, schedulingError } = await getGroups(school.id);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-4">
      {schedulingError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Schedule data unavailable</p>
            <p className="mt-0.5 text-destructive/80">{schedulingError}</p>
          </div>
        </div>
      )}
      <GroupsList
        groups={groups}
        schoolId={school.id}
        schoolSlug={schoolSlug}
        filter={{
          q: q ?? '',
          segment: (segment as Segment | undefined) ?? 'all',
          sort: (sort as SortKey | undefined) ?? 'alerts',
        }}
      />
    </main>
  );
}
