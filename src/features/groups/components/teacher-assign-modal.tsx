'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Search, Check, AlertCircle, AlertTriangle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import { assignTeacher } from '../api/mutations';
import type { TeacherAssignCandidate } from '../api/queries';
import type { TeacherRole, Slot } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotWeeklyHours(slots: Slot[]): number {
  return slots.reduce((acc, s) => {
    const [sh = 0, sm = 0] = s.start.split(':').map(Number);
    const [eh = 0, em = 0] = s.end.split(':').map(Number);
    return acc + (eh * 60 + em - sh * 60 - sm) / 60;
  }, 0);
}

const DAY_ORDER: Record<Slot['day'], number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** "Mon/Fri 18:00–19:30" — mirrors buildScheduleSummary in api/queries.ts,
 *  which is server-only and can't be imported into this client component. */
function scheduleSummaryOf(slots: Slot[]): string {
  if (slots.length === 0) return '—';
  const sorted = [...slots].sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day]);
  const days = [...new Set(sorted.map((s) => s.day))].join('/');
  const first = sorted[0];
  return first ? `${days} ${first.start}–${first.end}` : days;
}

// ── Role picker ───────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'primary',    labelKey: 'assignTeacher.roleOptions.primary',    subKey: 'assignTeacher.roleOptions.primarySub' },
  { value: 'co-primary', labelKey: 'assignTeacher.roleOptions.coPrimary',  subKey: 'assignTeacher.roleOptions.coPrimarySub' },
  { value: 'substitute', labelKey: 'assignTeacher.roleOptions.substitute', subKey: 'assignTeacher.roleOptions.substituteSub' },
] as const satisfies ReadonlyArray<{ value: TeacherRole; labelKey: string; subKey: string }>;

function isTeacherRole(value: string | null): value is TeacherRole {
  return value === 'primary' || value === 'co-primary' || value === 'substitute';
}

function RolePicker({
  value,
  onChange,
}: {
  value: TeacherRole;
  onChange: (r: TeacherRole) => void;
}) {
  const t = useTranslations('Groups');

  return (
    <div role="radiogroup" aria-label={t('assignTeacher.roleAria')} className="flex gap-2">
      {ROLES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'flex-1 rounded-[12px] border-[1.5px] px-3.25 py-2.75 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === r.value
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-(--ssz-border-default) hover:bg-subtle',
          )}
        >
          <div
            className={cn(
              'text-[13.5px] font-bold',
              value === r.value ? 'text-primary-700 dark:text-primary-300' : 'text-(--ssz-text-primary)',
            )}
          >
            {t(r.labelKey)}
          </div>
          <div className="mt-0.5 text-[11px] text-(--ssz-text-muted)">{t(r.subKey)}</div>
        </button>
      ))}
    </div>
  );
}

// ── Teacher option row ────────────────────────────────────────────────────────

function TeacherOption({
  candidate,
  selected,
  groupWeeklyHours,
  onSelect,
}: {
  candidate: TeacherAssignCandidate;
  selected: boolean;
  groupWeeklyHours: number;
  onSelect: () => void;
}) {
  const t = useTranslations('Groups');
  const projectedHours = candidate.currentHours + groupWeeklyHours;
  const wouldOverload = projectedHours > candidate.maxWeeklyHours;
  const dimmed = !candidate.langFit;
  const fillPct = Math.min((candidate.currentHours / (candidate.maxWeeklyHours || 1)) * 100, 100);

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2.75 px-2.75 py-2.25 rounded-[12px] cursor-pointer',
        'border-[1.5px] transition-colors',
        selected
          ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
          : 'border-(--ssz-border-default) hover:bg-subtle',
        dimmed && !selected && 'opacity-50',
      )}
    >
      <Avatar name={candidate.name} src={candidate.avatarUrl ?? undefined} size="sm" className="size-8.5" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13.5px] font-semibold text-(--ssz-text-primary) truncate">
            {candidate.name}
          </span>
          {!candidate.langFit && (
            <span className="text-[10px] text-warning-600 dark:text-warning-400 font-medium">
              {t('assignTeacher.langMismatch')}
            </span>
          )}
          {candidate.availabilityStatus === 'conflict' && (
            <span className="text-[10px] text-error-600 dark:text-error-400 font-medium">
              {t('assignTeacher.timeClash')}
            </span>
          )}
          {candidate.availabilityStatus === 'absent' && (
            <span className="text-[10px] text-error-600 dark:text-error-400 font-medium">
              {t('assignTeacher.availabilityAbsent')}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-(--ssz-text-muted)">
          {candidate.currentHours.toFixed(1)}/{candidate.maxWeeklyHours}h
          {' · '}{candidate.currentGroups} {candidate.currentGroups === 1 ? 'group' : 'groups'}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`${candidate.name}: ${candidate.currentHours.toFixed(1)} of ${candidate.maxWeeklyHours}h`}
        aria-valuenow={Math.round(fillPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-18.5 h-1.25 rounded-full bg-border overflow-hidden shrink-0"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            wouldOverload ? 'bg-error-500' : fillPct >= 85 ? 'bg-warning-500' : 'bg-primary',
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {selected && <Check className="size-4 text-primary shrink-0" aria-hidden="true" />}
    </div>
  );
}

// ── Validation block ──────────────────────────────────────────────────────────

type ValidationState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'warn'; messages: string[] }
  | { status: 'error'; messages: string[] };

function ValidationBlock({ state, okLabel }: { state: ValidationState; okLabel: string }) {
  if (state.status === 'idle') return null;

  if (state.status === 'ok') {
    // Clean state carries no box — a banner is for something to resolve.
    return (
      <div className="flex items-center gap-2 px-0.5 py-1">
        <Check className="size-4 text-success-500 shrink-0" aria-hidden="true" />
        <span className="text-[13px] font-medium text-success-700 dark:text-success-400">{okLabel}</span>
      </div>
    );
  }

  if (state.status === 'warn') {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-warning-500 bg-warning-50 dark:bg-warning-900/20 px-4 py-3.5">
        {state.messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2.25">
            <AlertTriangle className="size-4 text-warning-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-[13px] leading-normal text-warning-700 dark:text-warning-300">{m}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-error-500 bg-error-50 dark:bg-error-900/20 px-4 py-3.5">
      {state.messages.map((m, i) => (
        <div key={i} className="flex items-start gap-2.25">
          <AlertCircle className="size-4 text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-[13px] leading-normal text-error-700 dark:text-error-300">{m}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  groupId: string;
  groupName: string;
  groupLang: string;
  groupSlots: Slot[];
  candidates: TeacherAssignCandidate[];
  schoolId: string;
  schoolSlug: string;
};

export function TeacherAssignModal({
  groupId,
  groupName,
  groupLang,
  groupSlots,
  candidates,
  schoolId,
  schoolSlug: _schoolSlug,
}: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const roleParam = searchParams.get('role');
  const [role, setRole] = useState<TeacherRole>(isTeacherRole(roleParam) ? roleParam : 'primary');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [subFrom, setSubFrom] = useState('');
  const [subTo, setSubTo] = useState('');
  const [subReason, setSubReason] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const groupWeeklyHours = useMemo(() => slotWeeklyHours(groupSlots), [groupSlots]);

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [candidates, query]);

  const selected = candidates.find((c) => c.userId === selectedId) ?? null;

  const wouldOverload = selected
    ? selected.currentHours + groupWeeklyHours > selected.maxWeeklyHours
    : false;

  const validationState = useMemo<ValidationState>(() => {
    if (!selected) return { status: 'idle' };
    const errors: string[] = [];
    const warns: string[] = [];
    if (selected.availabilityStatus === 'conflict') {
      errors.push(t('assignTeacher.validationConflict', { name: selected.name }));
    }
    if (selected.availabilityStatus === 'absent') {
      errors.push(t('assignTeacher.validationAbsent', { name: selected.name }));
    }
    if (!selected.langFit) {
      warns.push(
        t('assignTeacher.validationLangMismatch', {
          teacherLang: selected.langs.join(', ') || '—',
          groupLang: groupLang.toUpperCase(),
        }),
      );
    }
    if (wouldOverload) {
      const projected = (selected.currentHours + groupWeeklyHours).toFixed(1);
      warns.push(
        t('assignTeacher.validationOverload', { name: selected.name, projected, max: selected.maxWeeklyHours }),
      );
    }
    if (errors.length > 0) return { status: 'error', messages: [...errors, ...warns] };
    if (warns.length > 0) return { status: 'warn', messages: warns };
    return { status: 'ok' };
  }, [selected, groupLang, groupWeeklyHours, wouldOverload, t]);

  const needsOverride = validationState.status === 'error' || validationState.status === 'warn';
  const canAssign =
    selectedId !== null &&
    (role !== 'substitute' || subReason.trim().length > 0);

  function handleClose() {
    router.back();
  }

  function handleAssign() {
    if (!selectedId) return;
    const override = needsOverride;
    setServerError(null);
    startTransition(async () => {
      const result = await assignTeacher(
        schoolId,
        groupId,
        {
          userId: selectedId,
          role,
          from: subFrom || undefined,
          to: subTo || undefined,
          reason: subReason || undefined,
        },
        override,
      );
      if (result.ok) {
        const warnings = result.warnings ?? [];
        const label = warnings.length > 0
          ? `Assigned ${selected?.name} as ${role} — ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
          : `Assigned ${selected?.name} as ${role}`;
        toast.success(label);
        router.back();
        router.refresh();
      } else {
        if (result.conflicts && result.conflicts.length > 0) {
          setServerError(
            t('assignTeacher.serverRejected', {
              reasons: result.conflicts.map((c) => c.type).join(', '),
            }),
          );
        } else if (result.blocked) {
          setServerError(
            result.blocked === 'no-primary'
              ? t('assignTeacher.errorNoPrimary')
              : t('assignTeacher.errorBlocked'),
          );
        } else {
          setServerError(t('assignTeacher.errorGeneric'));
        }
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-155 max-h-[90dvh] flex flex-col overflow-hidden gap-0 p-0 rounded-xl border-[1.5px] border-(--ssz-border-default) shadow-(--ssz-shadow-xl) ring-0"
      >
        {/* Head */}
        <div className="flex items-start justify-between gap-3 px-5.5 pt-5 pb-3.5">
          <div>
            <DialogTitle className="text-[18px] font-bold tracking-[-0.01em]">
              {t('assignTeacher.title')}
            </DialogTitle>
            <DialogDescription className="mt-0.75 text-[13px] text-(--ssz-text-muted)">
              {t('assignTeacher.description', {
                groupName,
                schedule: scheduleSummaryOf(groupSlots),
              })}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('assignTeacher.cancel')}>
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        {/* Body */}
        <div className="flex flex-col overflow-y-auto flex-1 px-5.5">
          {/* Role picker */}
          <div className="flex flex-col gap-2 mb-5">
            <p className="text-[12.5px] font-semibold text-(--ssz-text-secondary)">
              {t('assignTeacher.role')}
            </p>
            <RolePicker value={role} onChange={(r) => { setRole(r); setSelectedId(null); }} />
          </div>

          {/* Substitute fields */}
          {role === 'substitute' && (
            <div className="flex flex-col gap-2.75 rounded-[12px] border-[1.5px] border-dashed border-(--ssz-border-strong) bg-subtle p-3.5 mb-4">
              <div className="grid grid-cols-2 gap-2.75">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sub-from">{t('assignTeacher.substituteFrom')}</Label>
                  <Input id="sub-from" type="date" value={subFrom} onChange={(e) => setSubFrom(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sub-to">{t('assignTeacher.substituteTo')}</Label>
                  <Input id="sub-to" type="date" value={subTo} onChange={(e) => setSubTo(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sub-reason">
                  {t('assignTeacher.substituteReason')} <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="sub-reason"
                  placeholder={t('assignTeacher.reasonPlaceholder')}
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                />
                {role === 'substitute' && !subReason.trim() && (
                  <p className="text-xs text-error-600">{t('assignTeacher.reasonRequired')}</p>
                )}
              </div>
            </div>
          )}

          {/* Teacher list */}
          <div className="flex flex-col gap-2 mb-4.5">
            <p className="text-[12.5px] font-semibold text-(--ssz-text-secondary)">
              {t('assignTeacher.chooseTeacher', { lang: groupLang.toUpperCase() })}
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('assignTeacher.search')}
                aria-label={t('assignTeacher.searchAria')}
                className={cn(
                  'h-9 w-full rounded-md border-[1.5px] border-(--ssz-border-default) bg-surface',
                  'pl-9 pr-3 text-sm text-(--ssz-text-primary)',
                  'placeholder:text-(--ssz-text-muted)',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
            </div>

            <div
              role="listbox"
              aria-label={t('assignTeacher.listAria')}
              aria-required="true"
              className="flex flex-col gap-1.75 max-h-64 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <p className="text-sm text-(--ssz-text-muted) text-center py-6">
                  {candidates.length === 0 ? t('assignTeacher.noTeachers') : t('assignTeacher.noMatch')}
                </p>
              ) : (
                filtered.map((c) => (
                  <TeacherOption
                    key={c.userId}
                    candidate={c}
                    selected={selectedId === c.userId}
                    groupWeeklyHours={groupWeeklyHours}
                    onSelect={() => setSelectedId(c.userId === selectedId ? null : c.userId)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Validation block */}
          <ValidationBlock state={validationState} okLabel={t('assignTeacher.validationOk')} />

          {/* Server error */}
          {serverError && (
            <div className="mt-2 flex items-start gap-2.25 rounded-[14px] border-[1.5px] border-error-500 bg-error-50 dark:bg-error-900/20 px-4 py-3.5">
              <AlertCircle className="size-4 text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 text-[13px] leading-normal text-error-700 dark:text-error-300">{serverError}</div>
              <button type="button" onClick={() => setServerError(null)} className="text-error-600 hover:text-error-800">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="pb-4" />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-5.5 py-4 border-t-[1.5px] border-(--ssz-border-default)">
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            {t('assignTeacher.cancel')}
          </Button>
          <Button
            variant={needsOverride ? 'secondary' : 'primary'}
            onClick={handleAssign}
            disabled={!canAssign || isPending}
          >
            {isPending
              ? t('assignTeacher.assigning')
              : needsOverride
                ? t('assignTeacher.assignAnyway')
                : t('assignTeacher.assign')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
