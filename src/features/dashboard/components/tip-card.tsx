import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DashboardRole, DataState } from '../types';

type TipCardProps = {
  role: DashboardRole;
  dataState: DataState;
};

type TipKey = 'ownerFull' | 'ownerPartial' | 'admin' | 'teacher';

function getTip(role: DashboardRole, dataState: DataState): TipKey | null {
  if (dataState === 'empty') return null;
  if (role === 'owner' && dataState === 'full') return 'ownerFull';
  if (role === 'owner' && dataState === 'partial') return 'ownerPartial';
  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'teacher';
  return null;
}

export function TipCard({ role, dataState }: TipCardProps) {
  const t = useTranslations('School.dashboard.tips');
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
      <p className="text-sm text-(--ssz-text-secondary)">{t(tip)}</p>
    </div>
  );
}
