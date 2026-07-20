'use client';

import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { Avatar } from '@/components/ui/avatar';
import type { MaterialKind } from '@/lib/content/lesson-types';

export interface ReaderTopBarProps {
  courseHref: string;
  unitPosition: number;
  itemKind: MaterialKind;
  itemTitle: string;
  avatarName?: string;
  avatarSrc?: string;
}

function ThemeToggle() {
  const t = useTranslations('Learning.reader.topbar');
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('toggleThemeToLight') : t('toggleThemeToDark')}
      className="flex rounded-md p-1.75 text-muted-foreground hover:bg-subtle"
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export function ReaderTopBar({
  courseHref,
  unitPosition,
  itemKind,
  itemTitle,
  avatarName,
  avatarSrc,
}: ReaderTopBarProps) {
  const t = useTranslations('Learning.reader.topbar');
  const tSidebar = useTranslations('Learning.reader.sidebar');
  const tContent = useTranslations('Content.materialType');

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-(--ssz-border-default) bg-surface px-6">
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        <Link
          href={courseHref}
          className="flex shrink-0 items-center gap-1 font-semibold text-secondary-foreground no-underline"
        >
          <ChevronLeft size={15} />
          {t('courseLabel')}
        </Link>
        <ChevronRight size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="shrink-0 font-semibold">{tSidebar('unitLabel', { n: unitPosition })}</span>
        <ChevronRight size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-bold text-foreground">
          {tContent(itemKind)} · {itemTitle}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <Avatar name={avatarName} src={avatarSrc} size="sm" />
      </div>
    </div>
  );
}
