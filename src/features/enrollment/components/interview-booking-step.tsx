'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

// Minimal slot type for interview booking (SchedulingProvider returns full Slot objects;
// here we only need display info + booking id)
interface InterviewSlot {
  id: string;
  date: string;
  from: string;
  to: string;
}

// ── Fixture slots (replace with SchedulingProvider call in Phase 4+) ──────────
const FIXTURE_SLOTS: InterviewSlot[] = [
  { id: 'slot-1', date: '2026-06-20', from: '10:00', to: '10:30' },
  { id: 'slot-2', date: '2026-06-20', from: '11:00', to: '11:30' },
  { id: 'slot-3', date: '2026-06-21', from: '14:00', to: '14:30' },
  { id: 'slot-4', date: '2026-06-22', from: '09:00', to: '09:30' },
];

type Props = {
  membershipId: string;
  schoolSlug: string;
  onComplete: () => void | Promise<void>;
};

export function InterviewBookingStep({ membershipId, schoolSlug: _schoolSlug, onComplete }: Props) {
  const t = useTranslations('Enrollment.InterviewBooking');
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    void (async () => {
      // TODO: fetch from SchedulingProvider once interview slots are available
      setSlots(FIXTURE_SLOTS);
    })();
  }, []);

  async function handleBook() {
    if (!selected) return;
    setBooking(true);
    try {
      // Record the booked slot on the membership (availability update)
      const slot = slots.find((s) => s.id === selected);
      if (!slot) return;

      const res = await fetch(`/api/enrollment/memberships/${membershipId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefs: [{ day: slot.date, from: slot.from, to: slot.to }],
        }),
      });

      if (!res.ok) throw new Error('Failed to book interview');

      toast.success(t('booked'));
      await onComplete();
    } catch {
      toast.error(t('bookFailed'));
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--ssz-text-secondary)">{t('subtitle')}</p>

      <div className="flex flex-col gap-2" role="listbox" aria-label={t('selectSlot')}>
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            role="option"
            aria-selected={selected === slot.id}
            onClick={() => setSelected(slot.id)}
            className={[
              'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
              selected === slot.id
                ? 'border-(--ssz-primary) bg-(--ssz-primary)/10 text-(--ssz-text-primary)'
                : 'border-border bg-surface text-(--ssz-text-secondary) hover:border-(--ssz-border-strong)',
            ].join(' ')}
          >
            <span className="font-medium">{slot.date}</span>
            {' '}
            <span className="text-(--ssz-text-muted)">{slot.from} – {slot.to}</span>
          </button>
        ))}
      </div>

      <Button onClick={handleBook} disabled={!selected || booking} className="self-end">
        {booking ? t('booking') : t('book')}
      </Button>
    </div>
  );
}
