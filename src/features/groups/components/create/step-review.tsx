'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useGroupCreateWizardStore } from '../../stores/create-wizard-store';
import type { AgeBand } from '../../types';

const AGE_BAND_LABEL: Record<AgeBand, string> = {
  kids: 'Kids',
  teens: 'Teens',
  adults: 'Adults',
};

type TeacherMeta = { userId: string; name: string };

type Props = {
  teachers: TeacherMeta[];
};

function ReviewRow({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 py-2.5 border-b border-border last:border-0', warn && 'text-warning-700 dark:text-warning-300')}>
      <span className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) w-28 shrink-0 mt-0.5">
        {label}
      </span>
      <span className="text-sm text-(--ssz-text-primary) flex-1">{value}</span>
    </div>
  );
}

export function StepReview({ teachers }: Props) {
  const store = useGroupCreateWizardStore();
  const {
    courseName, lang, level, name, mode, capacity,
    startDate, endDate, ageBand, slots, teachers: assignedTeachers, studentIds,
  } = store;

  const primary   = assignedTeachers.find((t) => t.role === 'primary');
  const coPrimary = assignedTeachers.find((t) => t.role === 'co-primary');
  const primaryMeta   = teachers.find((t) => t.userId === primary?.userId);
  const coPrimaryMeta = teachers.find((t) => t.userId === coPrimary?.userId);

  const hasPrimary = Boolean(primary);

  const slotsSummary = slots.length === 0
    ? 'None'
    : slots.map((s) => `${s.day} ${s.start}–${s.end}${s.room ? ` (${s.room})` : ''}`).join(', ');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">Review</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-0.5">
          The group will be created as a draft. Publish it from the detail page when ready.
        </p>
      </div>

      {!hasPrimary && (
        <div className="flex items-center gap-2 rounded-md bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 px-3 py-2">
          <AlertTriangle className="size-4 text-warning-600 shrink-0" aria-hidden="true" />
          <p className="text-sm text-warning-700 dark:text-warning-300">
            No primary teacher — the group can&apos;t be published until one is assigned.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <ReviewRow label="Name" value={name || '—'} />
        <ReviewRow label="Course" value={courseName ?? 'None (standalone)'} />
        <ReviewRow label="Language" value={`${lang.toUpperCase()} · ${level}`} />
        <ReviewRow label="Mode" value={mode === 'online' ? 'Online' : 'In-person'} />
        <ReviewRow
          label="Capacity"
          value={`${capacity.min} min · ${capacity.max} max`}
        />
        {(startDate || endDate) && (
          <ReviewRow
            label="Dates"
            value={[startDate, endDate].filter(Boolean).join(' → ') || '—'}
          />
        )}
        {ageBand && (
          <ReviewRow label="Age band" value={AGE_BAND_LABEL[ageBand]} />
        )}
        <ReviewRow
          label="Schedule"
          value={slotsSummary}
          warn={slots.length === 0}
        />
        <ReviewRow
          label="Primary"
          value={
            primaryMeta ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success-500" aria-hidden="true" />
                {primaryMeta.name}
              </span>
            ) : (
              <span className="text-warning-600 dark:text-warning-400">Not assigned</span>
            )
          }
          warn={!hasPrimary}
        />
        {coPrimaryMeta && (
          <ReviewRow label="Co-primary" value={coPrimaryMeta.name} />
        )}
        <ReviewRow
          label="Students"
          value={studentIds.length === 0 ? 'None (add later)' : `${studentIds.length} enrolled`}
        />
      </div>
    </div>
  );
}
