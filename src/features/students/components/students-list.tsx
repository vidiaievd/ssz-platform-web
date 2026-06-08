'use client';

import { useTranslations } from 'next-intl';
import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useStudentBulkSelect } from './students-filters';
import { StudentRow } from './student-row';
import type { StudentListItem, SegmentKey } from '@/features/students/types';
import { segmentPredicate } from '@/lib/students/status';

type Props = {
  students: StudentListItem[];
  schoolSlug: string;
  activeSegment: SegmentKey;
  search: string;
  onEnrollAction: () => void;
};

export function StudentsList({
  students,
  schoolSlug,
  activeSegment,
  search,
  onEnrollAction,
}: Props) {
  const t = useTranslations('Students');
  const { selectedIds, toggle } = useStudentBulkSelect(students);

  // Client-side search filter (server handles segment)
  const visible = students.filter((s) => {
    const pred = activeSegment !== 'all' ? segmentPredicate(activeSegment) : null;
    if (pred && !pred(s)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.groups.some((g) => g.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">
          {students.length === 0
            ? t('list.emptyDescription')
            : t('list.filteredEmpty')}
        </p>
        {students.length === 0 && (
          <Button onClick={onEnrollAction}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {t('list.enroll')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1" role="list" aria-label={t('list.title')}>
      {visible.map((s) => (
        <div key={s.userId} role="listitem">
          <StudentRow
            student={s}
            href={`/school/${schoolSlug}/students/${s.userId}`}
            selected={selectedIds.has(s.userId)}
            onSelect={toggle}
          />
        </div>
      ))}
    </div>
  );
}
