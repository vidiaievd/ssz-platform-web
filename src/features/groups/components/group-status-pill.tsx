import { getTranslations } from 'next-intl/server';

import { StatusPill } from '@/components/ui/status-pill';
import type { GroupStatus } from '../types';

type Tone = 'neutral' | 'success';

/** Dot glyph pairs with the tone so status never reads by color alone (spec §10 "Non-color"). */
const STATUS_CONFIG: Record<GroupStatus, { tone: Tone; dot: string; key: 'draft' | 'active' | 'archived' }> = {
  draft:    { tone: 'neutral', dot: '◍', key: 'draft' },
  active:   { tone: 'success', dot: '●', key: 'active' },
  archived: { tone: 'neutral', dot: '◌', key: 'archived' },
};

type Props = { status: GroupStatus; className?: string };

export async function GroupStatusPill({ status, className }: Props) {
  const t = await getTranslations('Groups');
  const { tone, dot, key } = STATUS_CONFIG[status];
  return (
    <StatusPill tone={tone} className={className}>
      {dot} {t(`status.${key}`)}
    </StatusPill>
  );
}
