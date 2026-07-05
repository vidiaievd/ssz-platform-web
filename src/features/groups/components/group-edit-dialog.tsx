'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
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
import { GroupEditCourseField } from './group-edit-course-field';
import { GroupEditMaterialsField } from './group-edit-materials-field';
import { SlotEditor } from './slot-editor';
import { updateGroup, updateSlots } from '../api/mutations';
import { groupEditSchema } from '../schemas';
import { todayISO } from '../lib/today-iso';
import { useSchoolAgeBands } from '../api/use-school-age-bands';
import type { DraftSlot } from '../stores/create-wizard-store';
import type { Group, Slot, AgeBand } from '../types';
import type { GroupCreateInput } from '../schemas';

function toDraftSlot(slot: Slot): DraftSlot {
  return { _id: slot.id ?? crypto.randomUUID(), day: slot.day, start: slot.start, end: slot.end, room: slot.room };
}

function toApiSlot(slot: DraftSlot): Slot {
  return { day: slot.day, start: slot.start, end: slot.end, room: slot.room };
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

type Props = {
  group: Group;
  schoolId: string;
  schoolSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GroupEditDialog({ group, schoolId, schoolSlug, open, onOpenChange }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [courseName, setCourseName] = useState(group.courseName ?? null);
  const [slots, setSlots] = useState<DraftSlot[]>(() => group.slots.map(toDraftSlot));
  const [slotsDirty, setSlotsDirty] = useState(false);
  const { data: offeredAgeBands } = useSchoolAgeBands(schoolSlug);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<GroupCreateInput>({
    resolver: zodResolver(
      groupEditSchema(group.studentCount, {
        maxBelowEnrolled: t('edit.maxBelowEnrolled', { count: group.studentCount }),
        endBeforeStart: t('edit.endBeforeStart'),
      }),
    ),
    defaultValues: {
      name: group.name,
      courseId: group.courseId,
      lang: group.lang,
      level: group.level,
      mode: group.mode,
      capacity: group.capacity,
      startDate: group.startDate ?? undefined,
      endDate: group.endDate ?? undefined,
      ageBand: group.ageBand,
    },
  });

  const levelValue = useWatch({ control, name: 'level' });
  const modeValue = useWatch({ control, name: 'mode' });
  const capacityMax = useWatch({ control, name: 'capacity.max' });
  const courseId = useWatch({ control, name: 'courseId' }) ?? null;
  const startDateValue = useWatch({ control, name: 'startDate' });
  const ageBandValue = useWatch({ control, name: 'ageBand' });

  const maxBelowEnrolled = capacityMax !== undefined && capacityMax < group.studentCount;

  function addSlot() {
    setSlots((s) => [...s, { _id: crypto.randomUUID(), day: 'Mon', start: '09:00', end: '10:00', room: '' }]);
    setSlotsDirty(true);
  }

  function removeSlot(id: string) {
    setSlots((s) => s.filter((sl) => sl._id !== id));
    setSlotsDirty(true);
  }

  function updateSlotDraft(id: string, patch: Partial<Omit<DraftSlot, '_id'>>) {
    setSlots((s) => s.map((sl) => (sl._id === id ? { ...sl, ...patch } : sl)));
    setSlotsDirty(true);
  }

  function onSubmit(data: GroupCreateInput) {
    startTransition(async () => {
      const [result, slotsResult] = await Promise.all([
        updateGroup(schoolId, group.id, {
          name: data.name,
          courseId: data.courseId ?? null,
          lang: data.lang,
          level: data.level,
          mode: data.mode,
          capacityMin: data.capacity.min,
          capacityMax: data.capacity.max,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          ageBand: data.ageBand ?? null,
        }),
        slotsDirty ? updateSlots(schoolId, group.id, slots.map(toApiSlot)) : Promise.resolve({ ok: true as const }),
      ]);
      if (result.ok && slotsResult.ok) {
        toast.success(t('edit.success'));
        onOpenChange(false);
        router.refresh();
      } else if (!result.ok) {
        toast.error(t('edit.error'));
      } else {
        toast.error(t('edit.slotsError'));
      }
    });
  }

  function requestClose() {
    if (isDirty || slotsDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleDiscard() {
    reset();
    setSlots(group.slots.map(toDraftSlot));
    setSlotsDirty(false);
    setCourseName(group.courseName ?? null);
    setDiscardOpen(false);
    onOpenChange(false);
  }

  // ⌘/Ctrl+S submits while the dialog is open.
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
      <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
        <DialogContent className="flex flex-col gap-0 sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{t('edit.title')}</DialogTitle>
            <DialogDescription>{t('edit.description')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 -mx-4 px-4 py-2 overflow-y-auto flex-1">
            {/* ── Identity ──────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                {t('edit.identity')}
              </legend>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">{t('edit.name')}</Label>
                <Input id="name" {...register('name')} placeholder={t('edit.namePlaceholder')} aria-describedby={errors.name ? 'name-error' : undefined} />
                {errors.name && <p id="name-error" className="text-xs text-error-600">{errors.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lang">{t('edit.lang')}</Label>
                <Input id="lang" {...register('lang')} placeholder={t('edit.langPlaceholder')} className="uppercase" aria-describedby={errors.lang ? 'lang-error' : undefined} />
                {errors.lang && <p id="lang-error" className="text-xs text-error-600">{errors.lang.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t('edit.level')}</Label>
                <Select value={levelValue} onValueChange={(v) => setValue('level', v as GroupCreateInput['level'], { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('edit.levelPlaceholder')} />
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
                <Label id="mode-label">{t('edit.mode')}</Label>
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
                      {m === 'online' ? t('row.online') : t('row.inPerson')}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* ── Course ────────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                {t('edit.course')}
              </legend>
              <GroupEditCourseField
                courseId={courseId}
                courseName={courseName}
                excludeCourseIds={group.materials.map((m) => m.courseId)}
                onChange={(id, name) => {
                  setValue('courseId', id, { shouldDirty: true });
                  setCourseName(name);
                }}
              />
            </fieldset>

            {/* ── Schedule ──────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                {t('edit.slotsHeading')}
              </legend>
              <SlotEditor
                slots={slots}
                mode={modeValue}
                onAdd={addSlot}
                onRemove={removeSlot}
                onUpdate={updateSlotDraft}
              />
            </fieldset>

            {/* ── Additional materials ──────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                {t('edit.materialsHeading')}
              </legend>
              <GroupEditMaterialsField
                schoolId={schoolId}
                groupId={group.id}
                materials={group.materials}
                mainCourseId={courseId}
              />
            </fieldset>

            {/* ── Capacity ──────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                {t('edit.capacity')}
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cap-min">{t('edit.minStudents')}</Label>
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
                  <Label htmlFor="cap-max">{t('edit.maxStudents')}</Label>
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
                      {t('edit.straddleNote', { count: group.studentCount })}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* ── Age band ──────────────────────────────────────────────── */}
            {offeredAgeBands && offeredAgeBands.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                  {t('edit.ageBand')}
                </legend>
                <Select
                  value={ageBandValue ?? '__none__'}
                  onValueChange={(v) =>
                    setValue('ageBand', v === '__none__' ? null : (v as AgeBand), { shouldDirty: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('edit.ageBandPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('edit.ageBandNone')}</SelectItem>
                    {offeredAgeBands.map((band) => (
                      <SelectItem key={band} value={band}>
                        {band === 'kids'
                          ? t('ageBand.kids')
                          : band === 'teens'
                            ? t('ageBand.teens')
                            : t('ageBand.adults')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
            )}

            {/* ── Dates ─────────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
                {t('edit.dates')}
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start-date">{t('edit.startDate')}</Label>
                  <Input id="start-date" type="date" min={todayISO()} {...register('startDate')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end-date">{t('edit.endDate')}</Label>
                  <Input
                    id="end-date"
                    type="date"
                    min={startDateValue || todayISO()}
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

          <DialogFooter className="sm:items-center sm:justify-between">
            <p className="text-xs text-(--ssz-text-muted) text-center sm:text-left">
              {t('edit.saveHint')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={requestClose} disabled={isPending}>
                {t('edit.cancel')}
              </Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={isPending || maxBelowEnrolled}>
                {isPending ? t('edit.saving') : t('edit.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard-while-dirty confirm */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('edit.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('edit.discardBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('edit.discardKeepEditing')}</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleDiscard}>
              {t('edit.discardDiscard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
