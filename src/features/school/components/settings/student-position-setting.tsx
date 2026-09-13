'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/features/review/components/primitives';

import { useSchool, useUpdateSchool } from '../../api/use-schools';

export interface StudentPositionSettingProps {
  schoolId: string;
  /** A reader who may not change it still sees what the school decided. */
  canEdit: boolean;
}

/**
 * Whether this school's learners are told where they stand in their group — plan 58,
 * screen F, decision D.
 *
 * One switch, because there is only one decision to make. What a learner sees when it is
 * on is a single sentence — "you are around the middle of your group" — with no rank, no
 * percentile, no classmate's number and no threshold; what they see when it is off is
 * nothing at all. Both are stated under the switch, so the choice is made against what it
 * actually does rather than against the word "position".
 *
 * Saved immediately rather than behind a Save button: it is one boolean, the answer is
 * visible in the switch, and a form with a single field and two buttons invites the
 * reader to look for the other fields.
 */
export function StudentPositionSetting({ schoolId, canEdit }: StudentPositionSettingProps) {
  const t = useTranslations('Settings.progress');
  const { data, isPending, isError } = useSchool(schoolId);
  const update = useUpdateSchool(schoolId);

  if (isError) {
    return (
      <Panel title={t('title')}>
        <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>
      </Panel>
    );
  }

  if (isPending || !data) return <Skeleton className="h-[150px] rounded-[14px]" />;

  // A school whose service predates the column showed the sentence, and that is what the
  // switch must say it is doing — `undefined` is not "off".
  const enabled = data.showGroupPositionToStudents ?? true;

  return (
    <Panel title={t('title')} sub={t('sub')}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold">{t('position.label')}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {enabled ? t('position.onHint') : t('position.offHint')}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={!canEdit || update.isPending}
          aria-label={t('position.label')}
          onCheckedChange={(next) =>
            update.mutate(
              { showGroupPositionToStudents: next },
              { onError: () => toast.error(t('saveFailed')) },
            )
          }
        />
      </div>

      {!canEdit && <p className="mt-3 text-[12.5px] text-muted-foreground">{t('readOnly')}</p>}
    </Panel>
  );
}
