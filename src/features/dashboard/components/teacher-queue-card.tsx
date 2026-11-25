import { useFormatter, useTranslations } from 'next-intl';
import { Pen, Mic, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
import type { WaitingWork, WaitingWorkPayload } from '@/lib/dashboard/queries';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import type { WidgetData } from '../types';

const KIND_ICON: Record<WaitingWork['kind'], LucideIcon> = {
  pen: Pen,
  mic: Mic,
};

type TeacherQueueCardProps = {
  work: WidgetData<WaitingWorkPayload>;
  /** The review screen the card leads to: the teacher's inbox, or oversight for the owner. */
  href: string;
  /** `school` — the owner's card: everything the school waits on, not their own inbox. */
  whose?: 'mine' | 'school';
  /** Pinned for the relative ages in tests; the request's own time otherwise. */
  now?: Date;
};

/**
 * Work waiting for a teacher — the oldest few submissions of the review queue and how many
 * wait in all. The teacher sees their groups, the owner the whole school; both open the
 * review screen from here.
 */
export function TeacherQueueCard({ work, href, whose = 'mine', now = new Date() }: TeacherQueueCardProps) {
  const t = useTranslations('School.dashboard.teacherQueue');
  const format = useFormatter();

  if (work.status === 'unavailable') {
    return <WidgetCard title={t('title')} unavailable />;
  }

  const subtitle = whose === 'school' ? t('subtitleSchool') : t('subtitle');
  const items = work.status === 'ok' ? work.data.items : [];
  const pending = work.status === 'ok' ? work.data.pending : 0;
  const open = (
    <Link
      href={href}
      className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      {t('open')}
    </Link>
  );

  if (items.length === 0) {
    return (
      <WidgetCard title={t('title')} subtitle={subtitle}>
        <WidgetEmptyState icon={ClipboardList} title={t('emptyTitle')} body={t('emptyBody')} />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title={t('title')} subtitle={subtitle} headerRight={open}>
      <ul role="list" aria-label={t('title')} className="divide-y divide-border -mx-4 -mb-4">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const who = item.who ?? t('someone');
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 min-h-[44px]">
              <span
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                aria-hidden="true"
              >
                {who.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{who}</p>
                <p className="font-mono text-[11px] text-(--ssz-text-muted) truncate">
                  {item.what ? `${item.what} · ` : ''}
                  {format.relativeTime(new Date(item.submittedAt), now)}
                </p>
              </div>
              <Icon
                className="size-4 shrink-0 text-(--ssz-text-muted)"
                aria-label={item.kind === 'pen' ? t('writing') : t('speaking')}
              />
            </li>
          );
        })}
        {pending > items.length && (
          <li className="px-4 py-2 text-xs text-(--ssz-text-muted)">
            {t('more', { count: pending - items.length })}
          </li>
        )}
      </ul>
    </WidgetCard>
  );
}
