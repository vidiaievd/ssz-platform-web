'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { assignTeacher } from '../api/mutations';
import type { TeacherRole } from '../types';

/** One person who could be added to the group, as the form needs to list them. */
export interface AssignTeacherOption {
  userId: string;
  name: string;
}

/** One group the assignment could be made to. */
export interface AssignTeacherGroup {
  id: string;
  name: string;
}

export interface AssignTeacherFormLabels {
  group: string;
  teacher: string;
  chooseTeacher: string;
  role: string;
  roleCoPrimary: string;
  roleSubstitute: string;
  from: string;
  to: string;
  reason: string;
  reasonRequired: string;
  cancel: string;
  submit: string;
  submitting: string;
  failed: string;
  /** The server's refusal of a second role for someone already in the group (OQ-17). */
  alreadyInGroup: string;
  /** The group already has a co-primary; a helper is then added as a substitute. */
  coPrimaryTaken: string;
}

export interface AssignTeacherFormProps {
  schoolId: string;
  groups: AssignTeacherGroup[];
  /** Preselected when the form was opened from a submission that belongs to a group. */
  initialGroupId?: string | null;
  teachers: AssignTeacherOption[];
  /**
   * Who teaches each group today, in any role, keyed by group id. They are not offered
   * for that group: one person holds one role in a group, and the server refuses a
   * second one (OQ-17). A group missing from the map hides nobody.
   */
  staffByGroup?: Readonly<Record<string, readonly string[]>>;
  labels: AssignTeacherFormLabels;
  onCancel: () => void;
  onAssigned: (assignment: { groupId: string; teacherId: string; role: TeacherRole }) => void;
}

/**
 * Adding a reviewer to a group — the one form, behind the one endpoint.
 *
 * There is no such thing as an "extra reviewer" in this system: who may review is derived
 * from who teaches the learner's group on the day the work was handed in (`DATA_MODEL.md`
 * §3), so the only way to give someone a queue is to put them in the group's staff. That
 * is why this posts to `POST /schools/:id/groups/:groupId/teachers` like every other
 * assignment, and why oversight grew no entity of its own (plan 46 §46.7).
 *
 * A substitution carries dates and ends by itself. The queue goes back to the lead teacher
 * on the closing date with nothing lost and nothing counted twice, because the rule is
 * evaluated against the submission's own moment rather than against today (criterion 37).
 *
 * `primary` is deliberately not offered. A group has one lead teacher and replacing them is
 * a scheduling decision made where the group is managed, not a side effect of clearing a
 * backlog.
 */
export function AssignTeacherForm({
  schoolId,
  groups,
  initialGroupId,
  teachers,
  staffByGroup,
  labels,
  onCancel,
  onAssigned,
}: AssignTeacherFormProps) {
  const [groupId, setGroupId] = useState(initialGroupId ?? groups[0]?.id ?? '');
  const [teacherId, setTeacherId] = useState('');
  const [role, setRole] = useState<TeacherRole>('co-primary');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState<false | 'generic' | 'already-in-group' | 'role-taken'>(false);
  const [isPending, startTransition] = useTransition();

  // The list depends on the group: someone already teaching it is left out, and a choice
  // made for another group falls back to "choose" rather than surviving as a hidden value.
  const staff = staffByGroup?.[groupId];
  const offered = staff ? teachers.filter((t) => !staff.includes(t.userId)) : teachers;
  const chosenId = offered.some((t) => t.userId === teacherId) ? teacherId : '';

  const needsReason = role === 'substitute' && reason.trim() === '';
  const canSubmit = groupId !== '' && chosenId !== '' && !needsReason && !isPending;

  const submit = () => {
    if (!canSubmit) return;
    setFailed(false);
    const teacherId = chosenId;

    startTransition(async () => {
      const result = await assignTeacher(
        schoolId,
        groupId,
        {
          userId: teacherId,
          role,
          from: from || undefined,
          to: to || undefined,
          reason: reason || undefined,
        },
        // Never `override`: on the server it replaces the group's current co-primary,
        // and a helper for overdue work must not quietly push a colleague out.
        false,
      );

      if (result.ok) onAssigned({ groupId, teacherId, role });
      else
        setFailed(
          result.blocked === 'already-in-group' || result.blocked === 'role-taken' ? result.blocked : 'generic',
        );
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-group">{labels.group}</Label>
        <select
          id="assign-group"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-teacher">{labels.teacher}</Label>
        <select
          id="assign-teacher"
          value={chosenId}
          onChange={(event) => setTeacherId(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value="">{labels.chooseTeacher}</option>
          {offered.map((teacher) => (
            <option key={teacher.userId} value={teacher.userId}>
              {teacher.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{labels.role}</span>
        <div
          role="radiogroup"
          aria-label={labels.role}
          className="flex overflow-hidden rounded-md border border-input"
        >
          {(
            [
              ['co-primary', labels.roleCoPrimary],
              ['substitute', labels.roleSubstitute],
            ] as const
          ).map(([value, label], index) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={role === value}
              onClick={() => setRole(value)}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
                role === value
                  ? 'bg-primary text-white'
                  : 'bg-background text-(--ssz-text-secondary) hover:bg-muted',
                index > 0 && 'border-l border-input',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-from">{labels.from}</Label>
          <Input
            id="assign-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-to">{labels.to}</Label>
          <Input
            id="assign-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {role === 'substitute' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-reason">{labels.reason}</Label>
          <Input
            id="assign-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {needsReason ? <p className="text-xs text-error-600">{labels.reasonRequired}</p> : null}
        </div>
      ) : null}

      {failed ? (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {failed === 'already-in-group'
            ? labels.alreadyInGroup
            : failed === 'role-taken'
              ? labels.coPrimaryTaken
              : labels.failed}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          {labels.cancel}
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {isPending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </div>
  );
}
