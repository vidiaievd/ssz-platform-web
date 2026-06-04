'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { CapacityMeter } from '@/components/shared/operations';
import { useGroupCreateWizardStore } from '../../stores/create-wizard-store';
import type { StudentCandidate } from '../../api/queries';

type Props = {
  students: StudentCandidate[];
};

export function StepStudents({ students }: Props) {
  const { studentIds, capacity, setField } = useGroupCreateWizardStore();
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(studentIds), [studentIds]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? students.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      : students;
  }, [students, query]);

  function toggle(userId: string) {
    const next = new Set(selectedSet);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setField('studentIds', [...next]);
  }

  const projected = studentIds.length;
  const overCap = projected > capacity.max;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">Add students</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-0.5">
          Optionally enrol students now. You can always add more later.
        </p>
      </div>

      {/* Projected capacity */}
      {(projected > 0 || capacity.max > 0) && (
        <div className="rounded-lg border border-border bg-card p-3 max-w-xs">
          <CapacityMeter
            count={0}
            min={capacity.min}
            max={capacity.max}
            projected={projected > 0 ? projected : undefined}
          />
          {overCap && (
            <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
              Over the {capacity.max}-seat cap — you can still add with an override.
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className={cn(
            'h-9 w-full rounded-md border border-input bg-background',
            'pl-8 pr-3 text-sm placeholder:text-(--ssz-text-muted)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        />
      </div>

      {selectedSet.size > 0 && (
        <p className="text-xs text-primary font-medium">
          {selectedSet.size} student{selectedSet.size > 1 ? 's' : ''} selected
        </p>
      )}

      <div
        role="listbox"
        aria-multiselectable="true"
        aria-label="Select students to enrol"
        className="flex flex-col gap-1 max-h-72 overflow-y-auto"
      >
        {students.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted) text-center py-6">
            No school students found. You can add students later from the group detail page.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted) text-center py-4">
            No students match your search.
          </p>
        ) : (
          filtered.map((s) => {
            const isSelected = selectedSet.has(s.userId);
            return (
              <div
                key={s.userId}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(s.userId)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                  isSelected
                    ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                    : 'border-transparent hover:bg-muted/50',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggle(s.userId)}
                  aria-label={`Select ${s.name}`}
                  onClick={(e) => e.stopPropagation()}
                />
                <Avatar name={s.name} src={s.avatarUrl ?? undefined} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{s.name}</p>
                  <p className="text-xs text-(--ssz-text-muted) truncate">{s.email}</p>
                </div>
                <span className="text-xs font-mono text-(--ssz-text-muted) shrink-0">{s.level}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
