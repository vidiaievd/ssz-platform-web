'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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

// ── Role picker ───────────────────────────────────────────────────────────────

const ROLES: { value: TeacherRole; label: string }[] = [
  { value: 'primary',    label: 'Primary' },
  { value: 'co-primary', label: 'Co-primary' },
  { value: 'substitute', label: 'Substitute' },
];

function RolePicker({
  value,
  onChange,
}: {
  value: TeacherRole;
  onChange: (r: TeacherRole) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Teacher role" className="flex rounded-md border border-input overflow-hidden">
      {ROLES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            value === r.value
              ? 'bg-primary text-white'
              : 'bg-background text-(--ssz-text-secondary) hover:bg-muted',
            r.value !== 'primary' && 'border-l border-input',
          )}
        >
          {r.label}
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
        'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
        'border transition-colors',
        selected
          ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
          : 'border-transparent hover:bg-muted/60',
        dimmed && !selected && 'opacity-50',
      )}
    >
      <Avatar name={candidate.name} src={candidate.avatarUrl ?? undefined} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-(--ssz-text-primary) truncate">
            {candidate.name}
          </span>
          {!candidate.langFit && (
            <span className="text-[10px] text-warning-600 dark:text-warning-400 font-medium">
              lang mismatch
            </span>
          )}
          {candidate.conflictsWithGroup && (
            <span className="text-[10px] text-error-600 dark:text-error-400 font-medium">
              time clash
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div
            role="progressbar"
            aria-label={`${candidate.name}: ${candidate.currentHours.toFixed(1)} of ${candidate.maxWeeklyHours}h`}
            aria-valuenow={Math.round(fillPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="flex-1 h-1 rounded-full bg-border overflow-hidden"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                wouldOverload ? 'bg-error-500' : fillPct >= 85 ? 'bg-warning-500' : 'bg-primary',
              )}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="text-[11px] text-(--ssz-text-muted) font-mono whitespace-nowrap">
            {candidate.currentHours.toFixed(1)}/{candidate.maxWeeklyHours}h
            {' · '}{candidate.currentGroups} {candidate.currentGroups === 1 ? 'group' : 'groups'}
          </span>
        </div>
      </div>

      {selected && (
        <CheckCircle2 className="size-4 text-primary shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}

// ── Validation block ──────────────────────────────────────────────────────────

type ValidationState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'warn'; messages: string[] }
  | { status: 'error'; messages: string[] };

function ValidationBlock({ state }: { state: ValidationState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'ok') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 px-3 py-2">
        <CheckCircle2 className="size-4 text-success-600 shrink-0" aria-hidden="true" />
        <span className="text-sm text-success-700 dark:text-success-300">Good to assign</span>
      </div>
    );
  }

  if (state.status === 'warn') {
    return (
      <div className="flex flex-col gap-1 rounded-md bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 px-3 py-2">
        {state.messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-sm text-warning-700 dark:text-warning-300">{m}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 px-3 py-2">
      {state.messages.map((m, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertCircle className="size-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-sm text-error-700 dark:text-error-300">{m}</span>
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
  schoolSlug: _,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [role, setRole] = useState<TeacherRole>('primary');
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
    if (selected.conflictsWithGroup) {
      errors.push(`Schedule conflict: ${selected.name} already has a lesson at this time.`);
    }
    if (!selected.langFit) {
      warns.push(
        `Language mismatch: teacher speaks ${selected.langs.join(', ') || '—'}, group language is ${groupLang.toUpperCase()}.`,
      );
    }
    if (wouldOverload) {
      const projected = (selected.currentHours + groupWeeklyHours).toFixed(1);
      warns.push(
        `This would bring ${selected.name} to ${projected}/${selected.maxWeeklyHours}h per week.`,
      );
    }
    if (errors.length > 0) return { status: 'error', messages: [...errors, ...warns] };
    if (warns.length > 0) return { status: 'warn', messages: warns };
    return { status: 'ok' };
  }, [selected, groupLang, groupWeeklyHours, wouldOverload]);

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
            `Server rejected: ${result.conflicts.map((c) => c.type).join(', ')}. Use "Assign anyway" to override.`,
          );
        } else if (result.blocked) {
          setServerError(
            result.blocked === 'no-primary'
              ? 'Assign a primary teacher first before adding a co-primary.'
              : 'This assignment is not allowed.',
          );
        } else {
          setServerError('Assignment failed. Please try again.');
        }
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90dvh] flex flex-col overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
          <DialogHeader>
            <DialogTitle>Assign teacher</DialogTitle>
            <DialogDescription>
              Assigning to <strong>{groupName}</strong> · lang: {groupLang.toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {/* Role picker */}
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <RolePicker value={role} onChange={(r) => { setRole(r); setSelectedId(null); }} />
          </div>

          {/* Substitute fields */}
          {role === 'substitute' && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sub-from">From date</Label>
                  <Input id="sub-from" type="date" value={subFrom} onChange={(e) => setSubFrom(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sub-to">To date</Label>
                  <Input id="sub-to" type="date" value={subTo} onChange={(e) => setSubTo(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sub-reason">
                  Reason <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="sub-reason"
                  placeholder="e.g. Sick leave, vacation…"
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                />
                {role === 'substitute' && !subReason.trim() && (
                  <p className="text-xs text-error-600">Reason is required for substitutes.</p>
                )}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teachers…"
              aria-label="Search teachers by name"
              className={cn(
                'h-9 w-full rounded-md border border-input bg-background',
                'pl-8 pr-3 text-sm text-(--ssz-text-primary)',
                'placeholder:text-(--ssz-text-muted)',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>

          {/* Teacher listbox */}
          <div
            role="listbox"
            aria-label="Select teacher"
            aria-required="true"
            className="flex flex-col gap-1 max-h-64 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-(--ssz-text-muted) text-center py-6">
                {candidates.length === 0 ? 'All teachers are already assigned.' : 'No teachers match your search.'}
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

          {/* Validation block */}
          <ValidationBlock state={validationState} />

          {/* Server error */}
          {serverError && (
            <div className="flex items-start gap-2 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 px-3 py-2">
              <AlertCircle className="size-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 text-sm text-error-700 dark:text-error-300">{serverError}</div>
              <button type="button" onClick={() => setServerError(null)} className="text-error-600 hover:text-error-800">
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="rounded-b-xl">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!canAssign || isPending}
          >
            {isPending
              ? 'Assigning…'
              : needsOverride
                ? 'Assign anyway'
                : 'Assign teacher'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
