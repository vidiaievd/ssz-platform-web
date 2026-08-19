'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignTeacherForm } from '@/features/groups/components/assign-teacher-form';

import { reviewKeys } from '../../api/keys';
import { Note } from '../primitives';

/**
 * What the dialog was opened about.
 *
 * Two doors into one form. A late submission names the learner and preselects their group;
 * a teacher row names the colleague whose load prompted it and leaves the group to be
 * chosen. Both end in the same record, because there is only one way to make someone a
 * reviewer.
 */
export type AssignTarget =
  | {
      kind: 'submission';
      groupId: string | null;
      studentName: string | null;
      exerciseTitle: string | null;
      /** The learner was in no group: the form cannot help, and the dialog says why. */
      unassigned: boolean;
    }
  | { kind: 'teacher'; teacherName: string | null };

export interface AssignReviewerDialogProps {
  /** The school's id — the assignment endpoint takes ids, and oversight answers with one. */
  schoolId: string;
  target: AssignTarget | null;
  groups: { id: string; name: string }[];
  onClose: () => void;
}

/**
 * Give someone a queue — by adding them to a group's staff, which is the only thing that
 * makes a person a reviewer (criterion 36).
 *
 * The banner says exactly that, because the alternative reading is so natural: an
 * administrator pressing "assign" on a late submission expects to have assigned *that
 * submission*, and would otherwise be surprised to find their colleague now holds the
 * group's whole queue. That is not a side effect to hide; it is what the rule means, and
 * the reviewer sees the group's queue in their inbox from the moment it is saved.
 *
 * A submission from a learner in no group is the one case this cannot fix, and the dialog
 * says so rather than offering a form that would appear to work: `reviewers(sub)` runs
 * through the learner's group, so the learner has to be in one before anybody can be
 * responsible for their work.
 */
export function AssignReviewerDialog({
  schoolId,
  target,
  groups,
  onClose,
}: AssignReviewerDialogProps) {
  const t = useTranslations('Review.oversight.assign');
  const queryClient = useQueryClient();

  const { data: teachers, isPending } = useQuery({
    queryKey: ['review', 'assignable-teachers', schoolId],
    queryFn: async () => {
      const response = await fetch(`/api/schools/${encodeURIComponent(schoolId)}/teachers`);
      if (!response.ok) throw new Error('Failed to load teachers');
      const rows = (await response.json()) as { teacherId: string; name: string }[];
      return rows.map((row) => ({ userId: row.teacherId, name: row.name }));
    },
    enabled: target !== null,
    staleTime: 60_000,
  });

  const open = target !== null;
  const unassigned = target?.kind === 'submission' && target.unassigned;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {target === null
              ? null
              : target.kind === 'teacher'
                ? t('forTeacher', { name: target.teacherName ?? t('someone') })
                : t('for', {
                    student: target.studentName ?? t('someone'),
                    exercise: target.exerciseTitle ?? t('someExercise'),
                  })}
          </DialogDescription>
        </DialogHeader>

        {unassigned ? (
          <Note tone="warn" title={t('noGroup.title')}>
            {t('noGroup.body')}
          </Note>
        ) : (
          <>
            <Note tone="info" title={t('banner.title')}>
              {t('banner.body')}
            </Note>

            {isPending || teachers === undefined ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <AssignTeacherForm
                schoolId={schoolId}
                groups={groups}
                initialGroupId={target?.kind === 'submission' ? target.groupId : null}
                teachers={teachers}
                labels={{
                  group: t('group'),
                  teacher: t('teacher'),
                  chooseTeacher: t('chooseTeacher'),
                  role: t('role'),
                  roleCoPrimary: t('roleCoPrimary'),
                  roleSubstitute: t('roleSubstitute'),
                  from: t('from'),
                  to: t('to'),
                  reason: t('reason'),
                  reasonRequired: t('reasonRequired'),
                  cancel: t('cancel'),
                  submit: t('submit'),
                  submitting: t('submitting'),
                  failed: t('failed'),
                }}
                onCancel={onClose}
                onAssigned={() => {
                  toast.success(t('assigned'));
                  // The new reviewer's queue, the sidebar counts and this screen all
                  // change the moment the record exists (`API_CONTRACT.md` §8, §10).
                  void queryClient.invalidateQueries({ queryKey: reviewKeys.queues() });
                  void queryClient.invalidateQueries({ queryKey: reviewKeys.counts() });
                  void queryClient.invalidateQueries({ queryKey: reviewKeys.oversights() });
                  onClose();
                }}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
