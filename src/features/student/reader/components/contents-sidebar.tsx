'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronLeft, List, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import { ProgressBar } from '@/components/ui/progress';
import type {
  ReaderSidebarCourse,
  ReaderSidebarLevel,
  ReaderSidebarSection,
  ReaderSidebarUnit,
} from '../types';

export interface ContentsSidebarProps {
  course: ReaderSidebarCourse;
  /** Flat unit list — the fallback for courses whose units aren't grouped. */
  units: ReaderSidebarUnit[];
  /** Units grouped by "Leksjon"; when non-empty it replaces the flat list. */
  levels?: ReaderSidebarLevel[];
  activeItemId: string;
  /** Sub-lesson the reader is inside — the only one highlighted as current. */
  activeUnitId?: string;
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
            'truncate text-[12px] leading-tight',
            active
              ? 'font-bold text-primary-700 dark:text-primary-300'
              : done
                ? 'text-secondary-foreground'
                : 'text-foreground',
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
    <div className="mt-1">
      <div className="px-2 pt-1 pb-0.5 text-[9.5px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
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

/**
 * A sub-lesson — the middle tier of Leksjon → sub-lesson → material.
 * Deliberately flat: no pill, no number badge; weight and indentation carry the
 * hierarchy. Only the sub-lesson the reader currently has open is tinted — under
 * `gatingMode: open` every unfinished unit carries status `active`, so status
 * alone would paint the whole panel.
 *
 * The title is a link to the unit entry route: only the open unit carries
 * sections, so without it every other sub-lesson would be inert text and the
 * course would only be navigable from course home.
 */
function UnitBlock({
  unit,
  activeItemId,
  current,
}: {
  unit: ReaderSidebarUnit;
  activeItemId: string;
  current: boolean;
}) {
  const t = useTranslations('Learning.reader.sidebar');
  const [open, setOpen] = useState(unit.status === 'active');
  const done = unit.status === 'done';
  const locked = unit.status === 'locked';
  const hasChildren = unit.sections.length > 0;

  const label = (
    <>
      <span
        className={cn(
          'block truncate text-[12.5px] leading-tight',
          current
            ? 'font-bold text-primary-700 dark:text-primary-300'
            : done
              ? 'font-medium text-secondary-foreground'
              : 'font-semibold text-foreground',
        )}
      >
        {unit.title}
      </span>
      {unit.subtitle && (
        <span className="mt-0.5 block truncate text-[10px] leading-tight text-muted-foreground">
          {unit.subtitle}
        </span>
      )}
    </>
  );

  return (
    <div className="mb-px">
      <div
        aria-current={current ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border-l-2 py-1.5 pr-1.5 pl-1.5 text-left transition-colors',
          current
            ? 'border-l-primary bg-primary-100/50 dark:border-l-primary-400 dark:bg-primary-900/25'
            : 'border-l-transparent',
          locked && 'opacity-55',
          !current && !locked && 'hover:bg-subtle',
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t('collapseUnit') : t('expandUnit')}
            className="shrink-0 rounded"
          >
            <ChevronDown
              size={13}
              className={cn(
                'transition-transform duration-150',
                current ? 'text-primary-700 dark:text-primary-300' : 'text-muted-foreground',
              )}
              style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="w-3.25 shrink-0" aria-hidden="true" />
        )}
        {locked ? (
          <span className="min-w-0 flex-1" aria-disabled="true">
            {label}
          </span>
        ) : (
          <Link href={unit.href} className="min-w-0 flex-1 no-underline">
            {label}
          </Link>
        )}
        {done ? (
          <Check size={13} className="shrink-0 text-(--ssz-feedback-ok-line)" aria-hidden="true" />
        ) : locked ? (
          <Lock size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>
      {open && hasChildren && (
        <div className="mt-0.5 mb-1 ml-2.5 border-l-[1.5px] border-(--ssz-border-default) pr-0.5 pl-1.5">
          {unit.sections.map((section) => (
            <SectionBlock key={section.id} section={section} activeItemId={activeItemId} />
          ))}
        </div>
      )}
    </div>
  );
}

function LevelBlock({
  level,
  activeItemId,
  activeUnitId,
}: {
  level: ReaderSidebarLevel;
  activeItemId: string;
  activeUnitId?: string;
}) {
  const t = useTranslations('Learning.reader.sidebar');
  /*
    Null until the reader touches the header: the level holding the open unit
    expands on its own, and keeps following navigation across levels, but a
    deliberate collapse/expand wins from then on.
  */
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? level.active;
  const done = level.units.filter((u) => u.status === 'done').length;
  const total = level.units.length;
  const complete = total > 0 && done === total;
  const panelId = `reader-level-${level.id}`;

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-subtle"
      >
        <ChevronDown
          size={15}
          className="shrink-0 text-muted-foreground transition-transform duration-150"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-foreground">
          {level.title}
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
            complete
              ? 'bg-(--ssz-feedback-ok-bg) text-(--ssz-feedback-ok-fg)'
              : 'bg-subtle text-muted-foreground',
          )}
        >
          {t('levelUnits', { done, total })}
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          className="mt-0.5 mb-1 ml-2.5 border-l-[1.5px] border-(--ssz-border-default) pl-1.5"
        >
          {level.units.map((unit) => (
            <UnitBlock
              key={unit.id}
              unit={unit}
              activeItemId={activeItemId}
              current={unit.id === activeUnitId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentsSidebar({
  course,
  units,
  levels,
  activeItemId,
  activeUnitId,
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
        {levels && levels.length > 0
          ? levels.map((level) => (
              <LevelBlock
                key={level.id}
                level={level}
                activeItemId={activeItemId}
                activeUnitId={activeUnitId}
              />
            ))
          : units.map((unit) => (
              <UnitBlock
                key={unit.id}
                unit={unit}
                activeItemId={activeItemId}
                current={unit.id === activeUnitId}
              />
            ))}
      </div>
    </aside>
  );
}
