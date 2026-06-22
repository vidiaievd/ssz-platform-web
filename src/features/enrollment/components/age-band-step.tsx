'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { AgeBand } from '@/features/groups/types';

type Props = {
  membershipId: string;
  schoolId: string;
  offeredAgeBands: AgeBand[];
  onComplete: () => void | Promise<void>;
};

export function AgeBandStep({ membershipId, schoolId, offeredAgeBands, onComplete }: Props) {
  const t = useTranslations('Enrollment.AgeBand');
  const [selected, setSelected] = useState<AgeBand | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/enrollment/memberships/${membershipId}/age-band`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, ageBand: selected }),
      });

      if (!res.ok) throw new Error('Failed to submit age band');
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

      <div role="radiogroup" aria-label={t('subtitle')} className="flex flex-col gap-2">
        {offeredAgeBands.map((band) => (
          <label
            key={band}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
              selected === band
                ? 'border-(--ssz-primary) bg-(--ssz-primary)/5'
                : 'border-border hover:bg-muted',
            )}
          >
            <input
              type="radio"
              name="age-band"
              value={band}
              checked={selected === band}
              onChange={() => setSelected(band)}
              className="size-4"
            />
            <Label className="cursor-pointer">
              {band === 'kids' ? t('kids') : band === 'teens' ? t('teens') : t('adults')}
            </Label>
          </label>
        ))}
      </div>

      <Button onClick={handleSubmit} disabled={saving || !selected} className="self-end">
        {saving ? t('saving') : t('submit')}
      </Button>
    </div>
  );
}
