'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CourseManageDialog } from './course-manage-dialog';
import type { Group } from '../types';

type Props = {
  group: Group;
  schoolId: string;
  label: string;
};

/** Opens the existing course/materials dialog from a server-rendered surface. */
export function CourseChangeButton({ group, schoolId, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
        {label}
      </Button>
      <CourseManageDialog group={group} schoolId={schoolId} open={open} onOpenChange={setOpen} />
    </>
  );
}
