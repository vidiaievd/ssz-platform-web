'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { EnrollDialog } from './enroll-dialog';
import type { GroupSelectOption } from '../api/queries';

type Props = { schoolId: string; groups: GroupSelectOption[] };

export function EnrollShell({ schoolId, groups }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const open = searchParams.get('enroll') === '1';

  function handleOpenChange(v: boolean) {
    if (!v) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('enroll');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  return (
    <EnrollDialog
      open={open}
      onOpenChangeAction={handleOpenChange}
      schoolId={schoolId}
      groups={groups}
    />
  );
}
