import { Lightbulb } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DashboardRole, DataState } from '../types';

type TipCardProps = {
  role: DashboardRole;
  dataState: DataState;
};

type TipConfig = {
  body: string;
};

function getTip(role: DashboardRole, dataState: DataState): TipConfig | null {
  if (dataState === 'empty') return null;

  if (role === 'owner' && dataState === 'full') {
    return { body: 'Pin your most-used shortcuts to the sidebar for faster navigation.' };
  }
  if (role === 'owner' && dataState === 'partial') {
    return { body: 'Some teachers haven\'t accepted their invitations yet. Send them a reminder.' };
  }
  if (role === 'admin') {
    return { body: 'Set up auto-approval for routine content submissions to speed up your review queue.' };
  }
  if (role === 'teacher') {
    return { body: 'Use bulk grading to score multiple submissions at once and save time.' };
  }
  return null;
}

export function TipCard({ role, dataState }: TipCardProps) {
  const tip = getTip(role, dataState);
  if (!tip) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-dashed border-border bg-card/50 p-4',
      )}
    >
      <Lightbulb
        className="size-4 shrink-0 mt-0.5 text-(--ssz-text-muted)"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <p className="text-sm text-(--ssz-text-secondary)">{tip.body}</p>
    </div>
  );
}
