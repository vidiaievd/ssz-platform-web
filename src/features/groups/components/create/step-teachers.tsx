'use client';

import { useState, useMemo } from 'react';
import { Search, CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { slotsOverlap } from '@/lib/groups/operations';
import { useGroupCreateWizardStore } from '../../stores/create-wizard-store';
import type { WizardTeacherRole } from '../../stores/create-wizard-store';
import type { TimetableTeacher } from '../../types';

type TeacherMeta = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  maxWeeklyHours: number;
  langs: string[];
};

type Props = {
  teachers: TeacherMeta[];
  timetable: TimetableTeacher[];
};

const ROLE_CONFIG: Record<WizardTeacherRole, { tone: 'success' | 'accent'; label: string }> = {
  primary:    { tone: 'success', label: 'Primary' },
  'co-primary': { tone: 'accent', label: 'Co-primary' },
};

// ── Lifted out to avoid "cannot create components during render" ──────────────

function TeacherCard({
  userId,
  role,
  teachers,
  onRemove,
}: {
  userId: string;
  role: WizardTeacherRole;
  teachers: TeacherMeta[];
  onRemove: (id: string) => void;
}) {
  const meta = teachers.find((t) => t.userId === userId);
  if (!meta) return null;
  const { tone, label } = ROLE_CONFIG[role];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Avatar name={meta.name} src={meta.avatarUrl ?? undefined} size="sm" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-(--ssz-text-primary) truncate">{meta.name}</span>
      </div>
      <StatusPill tone={tone}>{label}</StatusPill>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(userId)}
        aria-label={`Remove ${meta.name}`}
        className="text-(--ssz-text-muted) hover:text-error-600"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

export function StepTeachers({ teachers, timetable }: Props) {
  const { teachers: assignedTeachers, slots, lang, addTeacher, removeTeacher } =
    useGroupCreateWizardStore();
  const [query, setQuery] = useState('');
  const [pickingRole, setPickingRole] = useState<WizardTeacherRole | null>(null);

  const primary    = assignedTeachers.find((t) => t.role === 'primary');
  const coPrimary  = assignedTeachers.find((t) => t.role === 'co-primary');

  // Compute conflict flags for each candidate against wizard slots
  const candidateFlags = useMemo(() => {
    const flags = new Map<string, { langFit: boolean; conflictsWithGroup: boolean; currentHours: number; maxHours: number }>();
    for (const t of teachers) {
      const tt = timetable.find((x) => x.userId === t.userId);
      const teacherSlots = (tt?.lessons ?? []).map((l) => ({ day: l.day, start: l.start, end: l.end, room: '' }));
      const conflictsWithGroup = slots.some((gs) =>
        teacherSlots.some((ts) => slotsOverlap(ts, { day: gs.day, start: gs.start, end: gs.end, room: gs.room })),
      );
      const langFit = t.langs.some((l) => l.toLowerCase() === lang.toLowerCase());
      const currentHours = tt?.hours ?? 0;
      flags.set(t.userId, { langFit, conflictsWithGroup, currentHours, maxHours: t.maxWeeklyHours });
    }
    return flags;
  }, [teachers, timetable, slots, lang]);

  const assignedIds = new Set(assignedTeachers.map((t) => t.userId));

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return teachers.filter(
      (t) => !assignedIds.has(t.userId) && t.name.toLowerCase().includes(q),
    );
  }, [teachers, assignedIds, query]);

  function handlePick(userId: string) {
    if (!pickingRole) return;
    addTeacher({ userId, role: pickingRole });
    setPickingRole(null);
    setQuery('');
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">Teachers</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-0.5">
          A primary teacher is required to publish the group.
        </p>
      </div>

      {/* Primary slot */}
      <section aria-labelledby="wiz-primary-heading">
        <div className="flex items-center justify-between mb-2">
          <h3 id="wiz-primary-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
            Primary teacher <span className="text-error-500">*</span>
          </h3>
          {!primary && (
            <Button variant="ghost" size="sm" onClick={() => setPickingRole('primary')}>
              + Assign primary
            </Button>
          )}
        </div>
        {primary ? (
          <TeacherCard userId={primary.userId} role="primary" teachers={teachers} onRemove={removeTeacher} />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 dark:border-error-700 dark:bg-error-900/20 px-3 py-2.5">
            <AlertCircle className="size-4 text-error-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-error-700 dark:text-error-300">
              No primary teacher assigned. Required to continue.
            </p>
          </div>
        )}
      </section>

      {/* Co-primary slot */}
      <section aria-labelledby="wiz-coprimary-heading">
        <div className="flex items-center justify-between mb-2">
          <h3 id="wiz-coprimary-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
            Co-primary teacher
          </h3>
          {!coPrimary && (
            <Button variant="ghost" size="sm" onClick={() => setPickingRole('co-primary')}>
              + Assign co-primary
            </Button>
          )}
        </div>
        {coPrimary ? (
          <TeacherCard userId={coPrimary.userId} role="co-primary" teachers={teachers} onRemove={removeTeacher} />
        ) : (
          <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">None — optional.</p>
        )}
      </section>

      {/* Teacher picker */}
      {pickingRole && (
        <div className="rounded-lg border border-primary bg-primary-50 dark:bg-primary-900/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-primary">
              Picking {pickingRole === 'primary' ? 'primary' : 'co-primary'} teacher
            </p>
            <Button variant="ghost" size="icon-sm" onClick={() => setPickingRole(null)}>
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teachers…"
              className={cn(
                'h-9 w-full rounded-md border border-input bg-background',
                'pl-8 pr-3 text-sm placeholder:text-(--ssz-text-muted)',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>

          <div role="listbox" aria-label="Select teacher" className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-(--ssz-text-muted) text-center py-3">No teachers available.</p>
            ) : (
              filtered.map((t) => {
                const flags = candidateFlags.get(t.userId);
                const hasConflict = flags?.conflictsWithGroup ?? false;
                const langMismatch = flags ? !flags.langFit : false;
                const fillPct = Math.min((flags?.currentHours ?? 0) / (t.maxWeeklyHours || 1) * 100, 100);
                return (
                  <div
                    key={t.userId}
                    role="option"
                    aria-selected={false}
                    onClick={() => handlePick(t.userId)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:bg-white dark:hover:bg-primary-900/30 cursor-pointer"
                  >
                    <Avatar name={t.name} src={t.avatarUrl ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-(--ssz-text-primary) truncate">{t.name}</span>
                        {langMismatch && (
                          <span className="text-[10px] text-warning-600 font-medium">lang mismatch</span>
                        )}
                        {hasConflict && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-error-600 font-medium">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            time clash
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                          <div className={cn('h-full rounded-full', fillPct >= 100 ? 'bg-error-500' : fillPct >= 85 ? 'bg-warning-500' : 'bg-primary')} style={{ width: `${fillPct}%` }} />
                        </div>
                        <span className="text-[11px] text-(--ssz-text-muted) font-mono whitespace-nowrap">
                          {(flags?.currentHours ?? 0).toFixed(1)}/{t.maxWeeklyHours}h
                        </span>
                      </div>
                    </div>
                    {hasConflict
                      ? <AlertCircle className="size-4 text-error-500 shrink-0" aria-hidden="true" />
                      : <CheckCircle2 className="size-4 text-primary shrink-0 opacity-0 group-hover:opacity-100" aria-hidden="true" />
                    }
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
