import { Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';

import { getMyStanding } from './api/get-my-standing';

/**
 * One sentence about where this learner is in their group — and never a second one.
 *
 * No percentile, no rank, no group median, no classmate's number, and no mention of how
 * much evidence it took (§3.6). A learner who is told "you are 4th of 11" starts working
 * on the ranking; a learner told "around the middle of your group" has been given the
 * only part of it that changes what they do next.
 *
 * Absent entirely when there is nothing to say — no group, a school that turned the
 * sentence off, or a group nobody has been measured in. An empty band is not a position,
 * and a placeholder saying so would be a rank of its own kind.
 */
export async function WhereYouStand({ userId, className }: { userId: string; className?: string }) {
  const standing = await getMyStanding(userId);
  if (!standing) return null;

  const t = await getTranslations('Mastery');

  return (
    <section
      className={cn(
        'flex items-start gap-2.5 rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4.5 shadow-(--ssz-shadow-xs)',
        className,
      )}
      aria-label={t('standing.title')}
    >
      <Users size={18} className="mt-0.5 shrink-0 text-(--ssz-text-secondary)" aria-hidden="true" />
      <div>
        <p className="text-[13.5px] font-bold text-(--ssz-text-primary)">
          {t(`standing.${standing.band}` as 'standing.middle')}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">
          {standing.groupName === null
            ? t('standing.note')
            : t('standing.noteNamed', { group: standing.groupName })}
        </p>
      </div>
    </section>
  );
}
