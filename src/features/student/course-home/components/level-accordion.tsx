'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CourseLevelGroup } from '@/features/learning';

import { UnitFlowList } from './unit-flow-list';

/* ── Default expand: first level that isn't fully done ──────────────
 * (all levels done → collapse everything, nothing left to resume). */
function defaultExpandedId(levels: CourseLevelGroup[]): string | null {
  const firstIncomplete = levels.find((level) => level.units.some((u) => u.status !== 'done'));
  return firstIncomplete?.id ?? null;
}

function levelProgress(level: CourseLevelGroup) {
  const done = level.units.filter((u) => u.status === 'done').length;
  return { done, total: level.units.length };
}

interface LevelRowProps {
  level: CourseLevelGroup;
  expanded: boolean;
  onToggle: () => void;
  courseId: string;
  locale: string;
}

function LevelRow({ level, expanded, onToggle, courseId, locale }: LevelRowProps) {
  const t = useTranslations('Learning.courseHome.levelAccordion');
  const { done, total } = levelProgress(level);
  const panelId = `level-panel-${level.id}`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-center gap-3 py-3.5 text-left"
      >
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform duration-150"
          style={{
            color: 'var(--ssz-text-muted)',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
          aria-hidden="true"
        />
        <span
          className="min-w-0 flex-1 truncate font-semibold"
          style={{ color: 'var(--ssz-text-primary)', fontSize: 15 }}
        >
          {level.title}
        </span>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
          style={{
            background: done >= total && total > 0 ? 'var(--ssz-color-success-100)' : 'var(--ssz-bg-muted)',
            color: done >= total && total > 0 ? 'var(--ssz-color-success-700)' : 'var(--ssz-text-muted)',
          }}
        >
          {t('units', { done, total })}
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="pb-2 pl-7">
          <UnitFlowList units={level.units} courseId={courseId} locale={locale} />
        </div>
      )}
    </div>
  );
}

export interface LevelAccordionProps {
  levels: CourseLevelGroup[];
  courseId: string;
  locale: string;
}

export function LevelAccordion({ levels, courseId, locale }: LevelAccordionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(() => defaultExpandedId(levels));

  if (levels.length === 0) return null;

  return (
    <ul className="divide-y" style={{ borderColor: 'var(--ssz-border-default)' }} aria-label="Course levels">
      {levels.map((level) => (
        <li key={level.id}>
          <LevelRow
            level={level}
            expanded={expandedId === level.id}
            onToggle={() => setExpandedId((cur) => (cur === level.id ? null : level.id))}
            courseId={courseId}
            locale={locale}
          />
        </li>
      ))}
    </ul>
  );
}
