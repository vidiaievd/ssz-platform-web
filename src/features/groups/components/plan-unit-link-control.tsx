'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { linkPlanUnit } from '../api/mutations';
import type { CurriculumUnit } from '@/features/teachers/types';

const NONE = '__none__';

type Props = {
  schoolId: string;
  groupId: string;
  /** Course unit this control stitches a plan unit to. */
  contentUnitId: string;
  planUnits: CurriculumUnit[];
  /** Plan unit currently teaching this course unit, if any. */
  linkedUnitId: string | null;
};

/**
 * Picks which unit of the teaching plan teaches this unit of the course. One
 * plan unit teaches at most one course unit, so choosing a unit that is already
 * stitched elsewhere moves it here rather than duplicating it.
 */
export function PlanUnitLinkControl({
  schoolId,
  groupId,
  contentUnitId,
  planUnits,
  linkedUnitId,
}: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    startTransition(async () => {
      // Clearing the old link first keeps the "one plan unit, one course unit"
      // rule true even while the second call is in flight.
      if (linkedUnitId && linkedUnitId !== next) {
        await linkPlanUnit(schoolId, groupId, linkedUnitId, null);
      }
      const result =
        next === NONE
          ? { ok: true as const }
          : await linkPlanUnit(schoolId, groupId, next, contentUnitId);

      if (result.ok) {
        toast.success(t('materials.linkSaved'));
        router.refresh();
      } else {
        toast.error(t('materials.linkError'));
      }
    });
  }

  return (
    <Select
      value={linkedUnitId ?? NONE}
      onValueChange={handleChange}
      disabled={isPending || planUnits.length === 0}
    >
      <SelectTrigger className="h-7 w-[190px] text-xs" aria-label={t('materials.linkLabel')}>
        <SelectValue placeholder={t('materials.linkNone')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('materials.linkNone')}</SelectItem>
        {planUnits.map((u) => (
          <SelectItem key={u.unitId} value={u.unitId}>
            {u.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
