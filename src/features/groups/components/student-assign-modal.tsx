'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CapacityMeter } from '@/components/shared/operations';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { addStudents } from '../api/mutations';
import type { StudentCandidate } from '../api/queries';

type Props = {
  groupId: string;
  groupName: string;
  capacity: { min: number; max: number };
  currentCount: number;
  candidates: StudentCandidate[];
  schoolId: string;
};

export function StudentAssignModal({
  groupId,
  groupName,
  capacity,
  currentCount,
  candidates,
  schoolId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const projected = currentCount + selectedIds.size;
  const overCap = projected > capacity.max;
  const underMin = projected < capacity.min && selectedIds.size > 0;

  function toggleStudent(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleClose() {
    router.back();
  }

  function handleAdd() {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await addStudents(
        schoolId,
        groupId,
        [...selectedIds],
        overCap,
      );
      if (result.ok) {
        const n = selectedIds.size;
        toast.success(`Added ${n} student${n > 1 ? 's' : ''}${overCap ? ' (over capacity — override applied)' : ''}`);
        router.back();
        router.refresh();
      } else {
        toast.error('Failed to add students. Please try again.');
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] flex flex-col overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
          <DialogHeader>
            <DialogTitle>Add students</DialogTitle>
            <DialogDescription>
              Adding to <strong>{groupName}</strong>. Select one or more students.
            </DialogDescription>
          </DialogHeader>

          {/* Projected capacity */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <CapacityMeter
              count={currentCount}
              min={capacity.min}
              max={capacity.max}
              projected={selectedIds.size > 0 ? projected : undefined}
            />
            {overCap && (
              <div className="flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-300">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                Adding {selectedIds.size} brings the group to {projected}, above the {capacity.max}-seat cap.
                You can still add with an override.
              </div>
            )}
            {underMin && (
              <p className="text-xs text-(--ssz-text-muted)">
                Note: group will still be under minimum ({capacity.min}) after adding.
              </p>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search students"
              className={cn(
                'h-9 w-full rounded-md border border-input bg-background',
                'pl-8 pr-3 text-sm text-(--ssz-text-primary)',
                'placeholder:text-(--ssz-text-muted)',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>

          {/* Selection count */}
          {selectedIds.size > 0 && (
            <p className="text-xs text-primary font-medium">
              {selectedIds.size} student{selectedIds.size > 1 ? 's' : ''} selected
            </p>
          )}

          {/* Student list */}
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label="Select students to add"
            className="flex flex-col gap-1 max-h-72 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-(--ssz-text-muted) text-center py-6">
                {candidates.length === 0
                  ? 'All school students are already enrolled in this group.'
                  : 'No students match your search.'}
              </p>
            ) : (
              filtered.map((c) => {
                const isSelected = selectedIds.has(c.userId);
                return (
                  <div
                    key={c.userId}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleStudent(c.userId)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                      'border transition-colors',
                      isSelected
                        ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                        : 'border-transparent hover:bg-muted/60',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleStudent(c.userId)}
                      aria-label={`Select ${c.name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar name={c.name} src={c.avatarUrl ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--ssz-text-primary) truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-(--ssz-text-muted) truncate">{c.email}</p>
                    </div>
                    <span className="text-xs font-mono text-(--ssz-text-muted) shrink-0">
                      {c.level}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="rounded-b-xl">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isPending}
          >
            {isPending
              ? 'Adding…'
              : overCap
                ? `Add ${selectedIds.size} (override capacity)`
                : `Add ${selectedIds.size || ''} student${selectedIds.size !== 1 ? 's' : ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
