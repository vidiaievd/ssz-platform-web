'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { updateGroup } from '../api/mutations';
import { groupCreateSchema } from '../schemas';
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GroupCreateInput>({
    resolver: zodResolver(groupCreateSchema),
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
  const modeValue  = watch('mode');

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit group</SheetTitle>
          <SheetDescription>Update this group&apos;s details and settings.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 py-2 overflow-y-auto flex-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} placeholder="e.g. Norwegian A2 — Spring 2026" />
            {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lang">Language code</Label>
            <Input id="lang" {...register('lang')} placeholder="en, nb, uk, ru…" className="uppercase" />
            {errors.lang && <p className="text-xs text-error-600">{errors.lang.message}</p>}
          </div>

          {/* Level */}
          <div className="flex flex-col gap-1.5">
            <Label>Level</Label>
            <Select value={levelValue} onValueChange={(v) => setValue('level', v as GroupCreateInput['level'])}>
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

          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <Select value={modeValue} onValueChange={(v) => setValue('mode', v as GroupCreateInput['mode'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="in-person">In-person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cap-min">Min students</Label>
              <Input
                id="cap-min"
                type="number"
                min={0}
                {...register('capacity.min', { valueAsNumber: true })}
              />
              {errors.capacity?.min && (
                <p className="text-xs text-error-600">{errors.capacity.min.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cap-max">Max students</Label>
              <Input
                id="cap-max"
                type="number"
                min={1}
                {...register('capacity.max', { valueAsNumber: true })}
              />
              {errors.capacity?.max && (
                <p className="text-xs text-error-600">{errors.capacity.max.message}</p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-date">Start date</Label>
              <Input id="start-date" type="date" {...register('startDate')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end-date">End date</Label>
              <Input id="end-date" type="date" {...register('endDate')} />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
