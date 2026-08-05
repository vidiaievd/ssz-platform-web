'use client';

import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import type { MaterialKind } from '@/lib/content/lesson-types';

export interface ReaderTopBarProps {
  courseHref: string;
  unitPosition: number;
  /** "Leksjon" the open sub-lesson belongs to; omitted for ungrouped courses. */
  levelTitle?: string;
  /** Open sub-lesson. Falls back to "Unit {position}" when absent. */
  unitTitle?: string;
  itemKind: MaterialKind;
  itemTitle: string;
  avatarName?: string;
  avatarSrc?: string;
}

function Crumb({
  children,
  className,
  hiddenOnNarrow,
}: {
  children: React.ReactNode;
  className?: string;
  hiddenOnNarrow?: boolean;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', hiddenOnNarrow && 'hidden lg:flex')}>
      <ChevronRight size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className={cn('truncate', className ?? 'max-w-44 font-semibold')}>{children}</span>
    </span>
  );
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
  levelTitle,
  unitTitle,
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
        {/* The level crumb is the first to go on a narrow viewport — the
            sub-lesson and the open material matter more for orientation. */}
        {levelTitle && <Crumb hiddenOnNarrow>{levelTitle}</Crumb>}
        <Crumb>{unitTitle ?? tSidebar('unitLabel', { n: unitPosition })}</Crumb>
        <Crumb className="font-bold text-foreground">
          {tContent(itemKind)} · {itemTitle}
        </Crumb>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <Avatar name={avatarName} src={avatarSrc} size="sm" />
      </div>
    </div>
  );
}
