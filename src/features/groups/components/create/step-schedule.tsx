'use client';

import { useGroupCreateWizardStore } from '../../stores/create-wizard-store';
import { SlotEditor } from '../slot-editor';
import type { Weekday } from '../../stores/create-wizard-store';

export function StepSchedule() {
  const { slots, mode, addSlot, removeSlot, updateSlot } = useGroupCreateWizardStore();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">Schedule</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-0.5">
          Add recurring weekly lesson slots. Lessons and conflict checks are generated from these.
          {mode === 'in-person' && ' Room is required for in-person groups.'}
        </p>
      </div>

      <SlotEditor
        slots={slots}
        mode={mode}
        onAdd={() =>
          addSlot({ day: 'Mon' as Weekday, start: '09:00', end: '10:00', room: '' })
        }
        onRemove={removeSlot}
        onUpdate={updateSlot}
      />

      {slots.length === 0 && (
        <p className="text-xs text-error-600">At least one slot is required.</p>
      )}
    </div>
  );
}
