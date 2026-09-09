'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { markLessonHeld } from '../api/mutations';
import type { CurriculumUnit } from '@/features/teachers/types';

type Props = {
  schoolId: string;
  groupId: string;
  lessonId: string;
  units: CurriculumUnit[];
  /** Unit the generator attached to this lesson, if any — the obvious answer, pre-picked. */
  defaultUnitId: string | null;
};

/**
 * Marks one past lesson as actually held, naming the unit it taught. The unit is
 * required: group progress is counted per unit, so a held lesson that names none
 * would move nothing.
 */
export function LessonHeldControl({ schoolId, groupId, lessonId, units, defaultUnitId }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [unitId, setUnitId] = useState<string>(defaultUnitId ?? units[0]?.unitId ?? '');

  if (units.length === 0) {
    return (
      <span className="text-[11px] text-(--ssz-text-muted) whitespace-nowrap">
        {t('schedule.noPlan')}
      </span>
    );
  }

  function handleMark() {
    if (!unitId) return;
    startTransition(async () => {
      const result = await markLessonHeld(schoolId, groupId, lessonId, unitId);
      if (result.ok) {
        toast.success(t('schedule.marked'));
        router.refresh();
      } else {
        toast.error(t('schedule.markError'));
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={unitId} onValueChange={setUnitId} disabled={isPending}>
        <SelectTrigger className="h-8 w-[180px] text-xs" aria-label={t('schedule.unitLabel')}>
          <SelectValue placeholder={t('schedule.pickUnit')} />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u.unitId} value={u.unitId}>
              {u.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button size="sm" variant="outline" onClick={handleMark} disabled={isPending || !unitId}>
        <CheckCircle2 className="size-3.5 mr-1.5" aria-hidden="true" />
        {isPending ? t('schedule.marking') : t('schedule.markHeld')}
      </Button>
    </div>
  );
}
