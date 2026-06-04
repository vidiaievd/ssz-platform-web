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
      <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <p className="text-sm text-(--ssz-text-muted)">School not found.</p>
      </main>
    );
  }

  const groups = await getGroups(school.id);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <GroupsList
        groups={groups}
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
