'use client';

import { ChevronLeft, ChevronRight, Flame, Moon, Sun, Zap } from 'lucide-react';
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
  streakDays: number;
  xp: number;
  avatarName?: string;
  avatarSrc?: string;
}

function StreakBadge({ days }: { days: number }) {
  const t = useTranslations('Learning.reader.topbar');
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.25"
      style={{
        background: 'var(--ssz-color-warning-100)',
        borderColor: 'var(--ssz-color-warning-300)',
      }}
    >
      <Flame size={14} style={{ color: 'var(--ssz-color-warning-700)' }} aria-hidden="true" />
      <span className="text-[13px] font-bold" style={{ color: 'var(--ssz-color-warning-700)' }}>
        {t('streakDays', { count: days })}
      </span>
    </div>
  );
}

function XpBadge({ xp }: { xp: number }) {
  const t = useTranslations('Learning.reader.topbar');
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.25"
      style={{
        background: 'var(--ssz-color-secondary-100)',
        borderColor: 'var(--ssz-color-secondary-300)',
      }}
    >
      <Zap size={13} style={{ color: 'var(--ssz-color-secondary-700)' }} aria-hidden="true" />
      <span className="text-[13px] font-bold" style={{ color: 'var(--ssz-color-secondary-700)' }}>
        {t('xp', { xp })}
      </span>
    </div>
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
  itemKind,
  itemTitle,
  streakDays,
  xp,
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
        <StreakBadge days={streakDays} />
        <XpBadge xp={xp} />
        <ThemeToggle />
        <Avatar name={avatarName} src={avatarSrc} size="sm" />
      </div>
    </div>
  );
}
