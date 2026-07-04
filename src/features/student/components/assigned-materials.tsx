'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { ClipboardList, ChevronRight } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/lib/i18n/navigation';
import type { AssignedMaterial } from '../types';

interface AssignedMaterialsProps {
  assignments: AssignedMaterial[];
}

function DueBadge({ status }: { status: AssignedMaterial['status'] }) {
  const t = useTranslations('Student.AssignedMaterials');
  if (status !== 'overdue') return null;
  return <Badge variant="error">{t('overdue')}</Badge>;
}

function AssignmentRow({ assignment }: { assignment: AssignedMaterial }) {
  const format = useFormatter();
  const dueLabel = format.dateTime(new Date(assignment.dueAt), { day: 'numeric', month: 'short' });

  const content = (
    <>
      <div className="flex items-center gap-3">
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">{assignment.title}</p>
          <p className="text-xs text-muted-foreground">{dueLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DueBadge status={assignment.status} />
        {assignment.href && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
    </>
  );

  if (!assignment.href) {
    return <div className="flex items-center justify-between gap-3 py-3">{content}</div>;
  }

  return (
    <Link
      href={`${assignment.href}?assignmentId=${assignment.assignmentId}`}
      className="flex items-center justify-between gap-3 py-3 hover:bg-(--ssz-bg-muted) rounded-md px-1 -mx-1"
    >
      {content}
    </Link>
  );
}

/**
 * Homework explicitly assigned to the student, with a due date — additive to the
 * group's curriculum (browsable, no due date). Renders nothing when there's nothing due.
 */
export function AssignedMaterials({ assignments }: AssignedMaterialsProps) {
  const t = useTranslations('Student.AssignedMaterials');

  if (assignments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <div className="divide-y divide-border">
        {assignments.map((assignment) => (
          <AssignmentRow key={assignment.assignmentId} assignment={assignment} />
        ))}
      </div>
    </Card>
  );
}
