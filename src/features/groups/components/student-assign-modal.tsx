'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
import { useStudentCandidates } from '../api/use-student-candidates';
import { groupKeys } from '../api/keys';
import { studentKeys } from '@/features/students/api/keys';
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
  groupName: initialGroupName,
  capacity: initialCapacity,
  currentCount: initialCurrentCount,
  candidates: initialCandidates,
  schoolId,
}: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useStudentCandidates(schoolId, groupId, {
    initialData: {
      groupName: initialGroupName,
      currentCount: initialCurrentCount,
      capacity: initialCapacity,
      candidates: initialCandidates,
    },
  });
  const { groupName, capacity, currentCount, candidates } = data;
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
        toast.success(
          overCap
            ? t('addStudents.successOverride', { count: n })
            : n === 1
              ? t('addStudents.success', { count: n })
              : t('addStudents.successPlural', { count: n }),
        );
        queryClient.invalidateQueries({ queryKey: groupKeys.studentCandidates(schoolId, groupId) });
        queryClient.invalidateQueries({ queryKey: studentKeys.list(schoolId) });
        router.back();
        router.refresh();
      } else {
        toast.error(t('addStudents.error'));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] flex flex-col overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
          <DialogHeader>
            <DialogTitle>{t('addStudents.title')}</DialogTitle>
            <DialogDescription>
              {t('addStudents.description', { groupName })}
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
                {t('addStudents.overCapWarning', {
                  count: selectedIds.size,
                  projected,
                  max: capacity.max,
                })}
              </div>
            )}
            {underMin && (
              <p className="text-xs text-(--ssz-text-muted)">
                {t('addStudents.underMinNote', { min: capacity.min })}
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
              placeholder={t('addStudents.search')}
              aria-label={t('addStudents.searchAria')}
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
              {t('addStudents.selected', { count: selectedIds.size })}
            </p>
          )}

          {/* Student list */}
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={t('addStudents.listAria')}
            className="flex flex-col gap-1 max-h-72 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-(--ssz-text-muted) text-center py-6">
                {candidates.length === 0
                  ? t('addStudents.noStudents')
                  : t('addStudents.noMatch')}
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
                      aria-label={t('addStudents.selectAria', { name: c.name })}
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
            {t('addStudents.cancel')}
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isPending}
          >
            {isPending
              ? t('addStudents.adding')
              : overCap
                ? t('addStudents.addOverride', { count: selectedIds.size })
                : t('addStudents.addCount', { count: selectedIds.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
