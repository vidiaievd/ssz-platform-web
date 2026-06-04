'use client';

import { Plus, Trash2, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { slotsOverlap } from '@/lib/groups/operations';
import type { DraftSlot, Weekday } from '../stores/create-wizard-store';

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'Mon', label: 'Monday' },
  { value: 'Tue', label: 'Tuesday' },
  { value: 'Wed', label: 'Wednesday' },
  { value: 'Thu', label: 'Thursday' },
  { value: 'Fri', label: 'Friday' },
  { value: 'Sat', label: 'Saturday' },
  { value: 'Sun', label: 'Sunday' },
];

type Props = {
  slots: DraftSlot[];
  mode: 'online' | 'in-person';
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<DraftSlot, '_id'>>) => void;
  readOnly?: boolean;
};

function conflictSet(slots: DraftSlot[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      if (slotsOverlap({ day: a.day, start: a.start, end: a.end, room: a.room },
                       { day: b.day, start: b.start, end: b.end, room: b.room })) {
        ids.add(a._id);
        ids.add(b._id);
      }
    }
  }
  return ids;
}

export function SlotEditor({ slots, mode, onAdd, onRemove, onUpdate, readOnly = false }: Props) {
  const conflicts = conflictSet(slots);

  return (
    <div className="flex flex-col gap-3">
      {slots.length === 0 && (
        <p className="text-sm text-(--ssz-text-muted) text-center py-4">
          No recurring slots. Add at least one.
        </p>
      )}

      {slots.map((slot, i) => {
        const hasConflict = conflicts.has(slot._id);
        const [sh = 0, sm = 0] = slot.start.split(':').map(Number);
        const [eh = 0, em = 0] = slot.end.split(':').map(Number);
        const endBeforeStart = slot.start && slot.end && (eh * 60 + em) <= (sh * 60 + sm);

        return (
          <div
            key={slot._id}
            className={cn(
              'rounded-lg border p-3 flex flex-col gap-3',
              hasConflict ? 'border-error-300 bg-error-50 dark:border-error-700 dark:bg-error-900/20'
                          : 'border-border bg-card',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-(--ssz-text-muted) uppercase tracking-wide">
                Slot {i + 1}
              </span>
              {hasConflict && (
                <span className="flex items-center gap-1 text-[11px] text-error-600 dark:text-error-400 font-medium">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Overlaps with another slot
                </span>
              )}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(slot._id)}
                  aria-label={`Remove slot ${i + 1}`}
                  className="text-(--ssz-text-muted) hover:text-error-600 ml-auto"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Day */}
              <div className="flex flex-col gap-1 sm:col-span-1">
                <Label htmlFor={`slot-day-${slot._id}`}>Day</Label>
                <select
                  id={`slot-day-${slot._id}`}
                  value={slot.day}
                  disabled={readOnly}
                  onChange={(e) => onUpdate(slot._id, { day: e.target.value as Weekday })}
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-3 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:opacity-50',
                  )}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Start */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`slot-start-${slot._id}`}>Start</Label>
                <input
                  id={`slot-start-${slot._id}`}
                  type="time"
                  value={slot.start}
                  disabled={readOnly}
                  onChange={(e) => onUpdate(slot._id, { start: e.target.value })}
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-3 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:opacity-50',
                  )}
                />
              </div>

              {/* End */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`slot-end-${slot._id}`}>End</Label>
                <input
                  id={`slot-end-${slot._id}`}
                  type="time"
                  value={slot.end}
                  disabled={readOnly}
                  onChange={(e) => onUpdate(slot._id, { end: e.target.value })}
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-3 text-sm',
                    endBeforeStart ? 'border-error-400' : '',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:opacity-50',
                  )}
                />
                {endBeforeStart && (
                  <p className="text-xs text-error-600">End must be after start</p>
                )}
              </div>

              {/* Room (only for in-person) */}
              {mode === 'in-person' && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`slot-room-${slot._id}`}>
                    Room <span className="text-error-500">*</span>
                  </Label>
                  <input
                    id={`slot-room-${slot._id}`}
                    type="text"
                    value={slot.room}
                    disabled={readOnly}
                    onChange={(e) => onUpdate(slot._id, { room: e.target.value })}
                    placeholder="e.g. Room 101"
                    className={cn(
                      'h-9 rounded-md border border-input bg-background px-3 text-sm',
                      !slot.room.trim() && 'border-error-300',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:opacity-50',
                    )}
                  />
                  {!slot.room.trim() && (
                    <p className="text-xs text-error-600">Room is required for in-person</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="self-start gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add slot
        </Button>
      )}
    </div>
  );
}
