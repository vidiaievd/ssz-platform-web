import { ChevronRight, Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/lib/i18n/navigation';

/** Dashed, low-emphasis route into the catalogue — an offer, not a nudge. */
export async function ExploreCoursesCta() {
  const t = await getTranslations('Student.home.explore');

  return (
    <Link
      href="/student/catalogue"
      className="flex w-full items-center gap-3 rounded-lg border-[1.5px] border-dashed border-(--ssz-border-strong) bg-surface p-4 transition-colors duration-base ease-out-ssz hover:border-(--ssz-color-primary-500)"
    >
      <span
        className="flex size-9.5 shrink-0 items-center justify-center rounded-md bg-[oklch(0.93_0.05_168)]"
        aria-hidden="true"
      >
        <Search size={18} className="text-[oklch(0.44_0.09_168)]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-(--ssz-text-primary)">{t('title')}</span>
        <span className="mt-0.25 block text-xs text-(--ssz-text-muted)">{t('subtitle')}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
    </Link>
  );
}
