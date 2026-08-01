'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, List, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import { ProgressBar } from '@/components/ui/progress';
import type { ReaderSidebarCourse, ReaderSidebarSection, ReaderSidebarUnit } from '../types';

export interface ContentsSidebarProps {
  course: ReaderSidebarCourse;
  units: ReaderSidebarUnit[];
  activeItemId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

function ItemRow({ item, active }: { item: ReaderSidebarSection['items'][number]; active: boolean }) {
  const t = useTranslations('Learning.reader.sidebar');
  const tContent = useTranslations('Content.materialType');
  const def = getLessonTypeDefinition(item.kind);
  const Icon = def.icon;
  const done = item.status === 'completed';
  const locked = item.status === 'locked';

  const row = (
    <div
      className={cn(
        'flex min-h-9 items-center gap-2.5 rounded-md border-l-[2.5px] px-2.5 py-1.5 transition-colors',
        active
          ? 'border-l-primary bg-primary-100/60 dark:border-l-primary-400 dark:bg-primary-900/30'
          : 'border-l-transparent',
        !active && !locked && 'hover:bg-subtle',
        locked && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'flex size-5.5 shrink-0 items-center justify-center rounded-md',
          done ? 'bg-(--ssz-bg-brand-solid)' : active ? 'border-[1.5px] border-primary' : 'bg-subtle',
        )}
        aria-hidden="true"
      >
        {done ? (
          <Check size={12} className="text-(--ssz-text-on-brand)" />
        ) : locked ? (
          <Lock size={11} className="text-muted-foreground" />
        ) : (
          <Icon size={12} style={{ color: `var(${def.hueVar})` }} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-[12.5px] leading-tight',
            active ? 'font-bold text-primary-700 dark:text-primary-300' : done ? 'font-medium text-secondary-foreground' : 'font-medium text-foreground',
          )}
        >
          {item.title}
        </div>
        <div className="mt-0.5 flex gap-1.5 text-[10.5px] text-muted-foreground">
          <span>{tContent(item.kind)}</span>
          <span aria-hidden="true">·</span>
          <span>{item.durationLabel}</span>
        </div>
      </div>
    </div>
  );

  if (locked) {
    return (
      <div aria-disabled="true" aria-label={`${item.title} (${t('locked')})`}>
        {row}
      </div>
    );
  }

  return (
    <Link href={item.href} className="block no-underline">
      {row}
    </Link>
  );
}

function SectionBlock({ section, activeItemId }: { section: ReaderSidebarSection; activeItemId: string }) {
  return (
    <div className="mt-1.5">
      <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {section.label}
      </div>
      <div className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <ItemRow key={item.id} item={item} active={item.id === activeItemId} />
        ))}
      </div>
    </div>
  );
}

function UnitBlock({ unit, activeItemId }: { unit: ReaderSidebarUnit; activeItemId: string }) {
  const t = useTranslations('Learning.reader.sidebar');
  const [open, setOpen] = useState(unit.status === 'active');
  const done = unit.status === 'done';
  const active = unit.status === 'active';
  const locked = unit.status === 'locked';
  const hasChildren = unit.sections.length > 0;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => hasChildren && setOpen((o) => !o)}
        aria-expanded={hasChildren ? open : undefined}
        disabled={!hasChildren}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors',
          active ? 'bg-(--ssz-bg-brand-solid)' : 'bg-transparent',
          locked && 'opacity-55',
          hasChildren && !active && 'hover:bg-subtle',
        )}
      >
        <span
          className={cn(
            'flex size-6.5 shrink-0 items-center justify-center rounded-lg',
            active ? 'bg-white/20' : done ? 'bg-primary-100' : 'bg-subtle',
          )}
          aria-hidden="true"
        >
          {done ? (
            <Check size={14} className="text-primary-700" />
          ) : locked ? (
            <Lock size={12} className="text-muted-foreground" />
          ) : (
            <span
              className={cn(
                'text-xs font-extrabold',
                active ? 'text-(--ssz-text-on-brand)' : 'text-secondary-foreground',
              )}
            >
              {unit.position}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-[13px] leading-tight font-bold',
              active ? 'text-(--ssz-text-on-brand)' : 'text-foreground',
            )}
          >
            {unit.title}
          </div>
          {/*
            The active row keeps its subtitle at full opacity — white/80 on the
            brand fill is 2.78:1. Size and weight carry the hierarchy instead.
          */}
          <div
            className={cn(
              'truncate text-[10.5px] leading-tight',
              active ? 'text-(--ssz-text-on-brand)' : 'text-muted-foreground',
            )}
          >
            {t('unitLabel', { n: unit.position })}
            {unit.subtitle ? ` · ${unit.subtitle}` : ''}
          </div>
        </div>
        {hasChildren &&
          (open ? (
            <ChevronDown
              size={15}
              className={active ? 'text-(--ssz-text-on-brand)' : 'text-muted-foreground'}
            />
          ) : (
            <ChevronRight
              size={15}
              className={active ? 'text-(--ssz-text-on-brand)' : 'text-muted-foreground'}
            />
          ))}
      </button>
      {open && hasChildren && (
        <div className="mt-0.5 ml-3 border-l-[1.5px] border-(--ssz-border-default) py-0.5 pr-1 pl-2">
          {unit.sections.map((section) => (
            <SectionBlock key={section.id} section={section} activeItemId={activeItemId} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentsSidebar({
  course,
  units,
  activeItemId,
  collapsed,
  onToggleCollapse,
  className,
}: ContentsSidebarProps) {
  const t = useTranslations('Learning.reader.sidebar');

  if (collapsed) {
    return (
      <aside
        className={cn(
          'flex w-14 shrink-0 flex-col items-center gap-3.5 border-r border-(--ssz-border-default) bg-surface py-4',
          className,
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={t('showContents')}
          className="flex rounded-md p-2 text-muted-foreground hover:bg-subtle"
        >
          <List size={20} />
        </button>
        <div className="flex size-8 items-center justify-center rounded-[9px] bg-(--ssz-bg-brand-solid)">
          <span className="text-[11px] font-extrabold tracking-tighter text-(--ssz-text-on-brand)">
            SSZ
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'flex w-74 shrink-0 flex-col overflow-hidden border-r border-(--ssz-border-default) bg-surface',
        className,
      )}
    >
      <div className="border-b border-(--ssz-border-default) px-4 pt-4 pb-3.5">
        <div className="mb-3.5 flex items-center gap-2.5">
          <div className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] bg-(--ssz-bg-brand-solid)">
            <span className="text-[13px] font-extrabold tracking-tighter text-(--ssz-text-on-brand)">
              SSZ
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              {course.flag && <span aria-hidden="true">{course.flag}</span>}
              <span className="truncate">{course.title}</span>
            </div>
            {course.subtitle && (
              <div className="truncate text-[11px] text-muted-foreground">{course.subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t('hideContents')}
            className="flex shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-subtle"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11.5px] font-semibold text-secondary-foreground">
            {t('completed', { pct: course.percentComplete })}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {course.itemsDone}/{course.itemsTotal}
          </span>
        </div>
        <ProgressBar value={course.percentComplete} height={6} label={t('courseProgress')} />
      </div>
      <div className="flex-1 overflow-auto px-2.5 pt-3 pb-6">
        <div className="px-2 pb-2.5 text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
          {t('contentsHeading')}
        </div>
        {units.map((unit) => (
          <UnitBlock key={unit.id} unit={unit} activeItemId={activeItemId} />
        ))}
      </div>
    </aside>
  );
}
