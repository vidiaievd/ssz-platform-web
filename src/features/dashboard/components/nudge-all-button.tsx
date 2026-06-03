'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { nudgeAtRiskStudents } from '../api/nudge-at-risk';

type NudgeAllButtonProps = {
  count: number;
  schoolSlug: string;
  schoolId: string;
};

export function NudgeAllButton({ count, schoolSlug, schoolId }: NudgeAllButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [nudged, setOptimisticNudged] = useOptimistic(false);
  const [done, setDone] = useState(false);

  async function handleNudge() {
    if (done || isPending) return;
    startTransition(async () => {
      setOptimisticNudged(true);
      const result = await nudgeAtRiskStudents(schoolSlug, schoolId);
      if (result.success) {
        setDone(true);
        toast.success(`Nudged ${result.nudged} students`);
      } else {
        setOptimisticNudged(false);
        toast.error('Failed to send reminders. Please try again.');
      }
    });
  }

  if (nudged || done) {
    return (
      <span
        className="flex items-center gap-1.5 text-sm font-medium text-success-600"
        aria-live="polite"
        aria-atomic="true"
      >
        <CheckCircle2 className="size-4" />
        Sent ✓
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNudge}
      disabled={isPending || count === 0}
      aria-busy={isPending}
    >
      <Send className="size-3.5 mr-1.5" aria-hidden="true" />
      Nudge all {count}
    </Button>
  );
}
