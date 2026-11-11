'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Field } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MaintenanceStatus } from '@/features/school-lifecycle/types';

import { setContainerMaintenanceAction } from '../actions/container';

const STATUSES: MaintenanceStatus[] = ['maintained', 'unmaintained', 'obsolete'];

/**
 * Lets the author say a course is no longer looked after (plan 90, phase 5, Q5). Saves on
 * change — it is a flag about the course, not a field of the edit form — and puts the old value
 * back when the service refuses.
 */
export function MaintenanceStatusField({
  containerId,
  initial,
}: {
  containerId: string;
  initial: MaintenanceStatus | undefined;
}) {
  const t = useTranslations('SchoolLifecycle.maintenance');
  const [value, setValue] = useState<MaintenanceStatus>(initial ?? 'maintained');
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    const previous = value;
    const status = next as MaintenanceStatus;
    setValue(status);
    startTransition(async () => {
      const result = await setContainerMaintenanceAction(containerId, status);
      if (!result.ok) {
        setValue(previous);
        toast.error(t('saveFailed'));
        return;
      }
      toast.success(t('saved'));
    });
  }

  return (
    <Field label={t('label')} htmlFor="maintenanceStatus" hint={t('hint')}>
      <Select value={value} onValueChange={change} disabled={isPending}>
        <SelectTrigger id="maintenanceStatus" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
