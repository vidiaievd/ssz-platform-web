'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { AvailabilityPref } from '@/features/enrollment/types';

type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

const DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = [
  { id: 'morning', from: '08:00', to: '12:00' },
  { id: 'afternoon', from: '12:00', to: '17:00' },
  { id: 'evening', from: '17:00', to: '21:00' },
];

type Props = {
  membershipId: string;
  schoolId: string;
  onComplete: () => void | Promise<void>;
};

export function AvailabilityStep({ membershipId, schoolId, onComplete }: Props) {
  const t = useTranslations('Enrollment.Availability');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function key(day: string, slotId: string) {
    return `${day}-${slotId}`;
  }

  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const prefs: AvailabilityPref[] = [];
      for (const day of DAYS) {
        for (const slot of SLOTS) {
          if (selected.has(key(day, slot.id))) {
            prefs.push({ day, from: slot.from, to: slot.to });
          }
        }
      }

      const res = await fetch(`/api/enrollment/memberships/${membershipId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, prefs }),
      });

      if (!res.ok) throw new Error('Failed to submit availability');
      await onComplete();
    } catch {
      // error surfaced by onboarding stepper
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--ssz-text-secondary)">{t('subtitle')}</p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4 text-left font-medium text-(--ssz-text-muted)" />
              {SLOTS.map((s) => (
                <th key={s.id} className="py-2 px-2 text-center font-medium text-(--ssz-text-muted)">
                  {t(s.id as 'morning' | 'afternoon' | 'evening')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day} className="border-t border-border">
                <td className="py-2 pr-4 font-medium text-(--ssz-text-secondary)">
                  {t(day as 'Mon')}
                </td>
                {SLOTS.map((slot) => {
                  const k = key(day, slot.id);
                  return (
                    <td key={slot.id} className="py-2 px-2 text-center">
                      <Checkbox
                        id={k}
                        checked={selected.has(k)}
                        onCheckedChange={() => toggle(k)}
                        aria-label={`${day} ${slot.id}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-(--ssz-text-muted)">
        <Label>{t('legend')}</Label>
      </div>

      <Button onClick={handleSubmit} disabled={saving || selected.size === 0} className="self-end">
        {saving ? t('saving') : t('submit')}
      </Button>
    </div>
  );
}
