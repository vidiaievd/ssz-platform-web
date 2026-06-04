import type { GroupHealthRowVM } from '../types';

export type Segment = 'all' | 'attention' | 'drafts';
export type SortKey = 'alerts' | 'name' | 'students';

export interface GroupFilter {
  q?: string;
  segment?: Segment;
  sort?: SortKey;
}

export function filterGroups(
  groups: GroupHealthRowVM[],
  { q, segment = 'all', sort = 'alerts' }: GroupFilter,
): GroupHealthRowVM[] {
  let result = [...groups];

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    result = result.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        (g.courseName ?? '').toLowerCase().includes(needle) ||
        (g.primaryTeacher?.name ?? '').toLowerCase().includes(needle) ||
        (g.coPrimaryTeacher?.name ?? '').toLowerCase().includes(needle),
    );
  }

  if (segment === 'attention') {
    result = result.filter((g) => g.alerts.some((a) => a.severity === 'danger'));
  } else if (segment === 'drafts') {
    result = result.filter((g) => g.status === 'draft');
  }

  result.sort((a, b) => {
    if (sort === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sort === 'students') {
      return b.studentCount - a.studentCount;
    }
    // 'alerts' (default): danger count desc, then total alerts desc
    const dangerA = a.alerts.filter((x) => x.severity === 'danger').length;
    const dangerB = b.alerts.filter((x) => x.severity === 'danger').length;
    if (dangerB !== dangerA) return dangerB - dangerA;
    return b.alerts.length - a.alerts.length;
  });

  return result;
}

export function attentionCount(groups: GroupHealthRowVM[]): number {
  return groups.filter((g) => g.alerts.some((a) => a.severity === 'danger')).length;
}
