'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { updateGroup } from '../api/mutations';
import { groupEditSchema } from '../schemas';
import type { Group } from '../types';
import type { GroupCreateInput } from '../schemas';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

type Props = {
  group: Group;
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GroupEditSheet({ group, schoolId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<GroupCreateInput>({
    resolver: zodResolver(groupEditSchema(group.studentCount)),
    defaultValues: {
      name: group.name,
      lang: group.lang,
      level: group.level,
      mode: group.mode,
      capacity: group.capacity,
      startDate: group.startDate ?? undefined,
      endDate: group.endDate ?? undefined,
    },
  });

  const levelValue = watch('level');
  const modeValue = watch('mode');
  const capacityMax = watch('capacity.max');

  const maxBelowEnrolled = capacityMax !== undefined && capacityMax < group.studentCount;

  function onSubmit(data: GroupCreateInput) {
    startTransition(async () => {
      const result = await updateGroup(schoolId, group.id, {
        name: data.name,
        lang: data.lang,
        level: data.level,
        mode: data.mode,
        minCapacity: data.capacity.min,
        maxCapacity: data.capacity.max,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      });
      if (result.ok) {
        toast.success('Group updated');
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error('Failed to update group');
      }
    });
  }

  function requestClose() {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleDiscard() {
    reset();
    setDiscardOpen(false);
    onOpenChange(false);
  }

  // ⌘/Ctrl+S submits while the sheet is open.
  useEffect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit group</SheetTitle>
            <SheetDescription>Update this group&apos;s details and settings.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-4 py-2 overflow-y-auto flex-1">
            {/* ── Identity ──────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                Identity
              </legend>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g. Norwegian A2 — Spring 2026" aria-describedby={errors.name ? 'name-error' : undefined} />
                {errors.name && <p id="name-error" className="text-xs text-error-600">{errors.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lang">Language code</Label>
                <Input id="lang" {...register('lang')} placeholder="en, nb, uk, ru…" className="uppercase" aria-describedby={errors.lang ? 'lang-error' : undefined} />
                {errors.lang && <p id="lang-error" className="text-xs text-error-600">{errors.lang.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Level</Label>
                <Select value={levelValue} onValueChange={(v) => setValue('level', v as GroupCreateInput['level'], { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {CEFR_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.level && <p className="text-xs text-error-600">{errors.level.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label id="mode-label">Mode</Label>
                <div role="radiogroup" aria-labelledby="mode-label" className="flex rounded-md border border-input overflow-hidden">
                  {(['online', 'in-person'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={modeValue === m}
                      onClick={() => setValue('mode', m, { shouldDirty: true })}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        modeValue === m
                          ? 'bg-primary text-white'
                          : 'bg-background text-(--ssz-text-secondary) hover:bg-muted',
                        m !== 'online' && 'border-l border-input',
                      )}
                    >
                      {m === 'online' ? 'Online' : 'In-person'}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* ── Capacity ──────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                Capacity
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cap-min">Min students</Label>
                  <Input
                    id="cap-min"
                    type="number"
                    min={0}
                    {...register('capacity.min', { valueAsNumber: true })}
                    aria-describedby={errors.capacity?.min ? 'cap-min-error' : undefined}
                  />
                  {errors.capacity?.min && (
                    <p id="cap-min-error" className="text-xs text-error-600">{errors.capacity.min.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cap-max">Max students</Label>
                  <Input
                    id="cap-max"
                    type="number"
                    min={1}
                    {...register('capacity.max', { valueAsNumber: true })}
                    aria-describedby={errors.capacity?.max ? 'cap-max-error' : 'cap-max-note'}
                  />
                  {errors.capacity?.max ? (
                    <p id="cap-max-error" className="text-xs text-error-600">{errors.capacity.max.message}</p>
                  ) : (
                    <p id="cap-max-note" className="text-xs text-(--ssz-text-muted)">
                      {group.studentCount} enrolled — min/max must straddle current roster.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* ── Dates ─────────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                Dates
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start-date">Start date</Label>
                  <Input id="start-date" type="date" {...register('startDate')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end-date">End date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    {...register('endDate')}
                    aria-describedby={errors.endDate ? 'end-date-error' : undefined}
                  />
                  {errors.endDate && (
                    <p id="end-date-error" className="text-xs text-error-600">{errors.endDate.message}</p>
                  )}
                </div>
              </div>
            </fieldset>
          </form>

          <SheetFooter>
            <p className="text-xs text-(--ssz-text-muted) text-center sm:text-left">
              Press ⌘S (or Ctrl+S) to save
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={requestClose} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={isPending || maxBelowEnrolled}>
                {isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Discard-while-dirty confirm */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this group. Closing now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
