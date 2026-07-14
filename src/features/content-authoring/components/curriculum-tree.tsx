'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import type {
  CurriculumTree as CurriculumTreeData,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import { ContainerStateBadge } from './container-state-badge';
import { CurriculumSectionItems, MoveToSectionSelect } from './curriculum-item-reorder';

interface CurriculumTreeProps {
  tree: CurriculumTreeData;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  /** Called after a reorder or section move persists, so the caller can refetch the tree. */
  onChanged: () => void;
}

interface TreeRowProps {
  depth: number;
  icon: React.ReactNode;
  label: string;
  sub?: string | null;
  meta?: string | null;
  selected: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  state?: 'draft' | 'published' | null;
  right?: React.ReactNode;
}

function TreeRow({
  depth,
  icon,
  label,
  sub,
  meta,
  selected,
  expandable,
  expanded,
  onToggle,
  onSelect,
  state,
  right,
}: TreeRowProps) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ paddingLeft: 8 + depth * 20 }}
      className={cn(
        'flex min-h-9.5 cursor-pointer items-center gap-2 rounded-md pr-3 transition-colors',
        'border-l-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-l-primary bg-primary-100/60 dark:bg-primary-900/30'
          : 'border-l-transparent hover:bg-subtle',
      )}
    >
      {expandable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="flex shrink-0 items-center text-muted-foreground"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm text-foreground',
              depth === 0 ? 'font-bold' : 'font-semibold',
            )}
          >
            {label}
          </span>
          {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
        </div>
      </div>
      {meta && <span className="font-mono text-[10.5px] text-muted-foreground">{meta}</span>}
      {state && <ContainerStateBadge state={state} />}
      {right}
    </div>
  );
}

function ItemRow({
  item,
  sectionTitle,
  selectedId,
  onSelect,
  right,
}: {
  item: CurriculumTreeItemNode;
  sectionTitle: string | null;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  right?: React.ReactNode;
}) {
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;
  return (
    <TreeRow
      depth={2}
      icon={
        <span
          className="flex h-6.5 w-6.5 items-center justify-center rounded-md"
          style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}
        >
          <Icon size={13} style={{ color: `var(${def.hueVar})` }} />
        </span>
      }
      label={item.title ?? ''}
      meta={item.durationMinutes ? `${item.durationMinutes} min` : null}
      state={item.state}
      selected={selectedId === item.id}
      onSelect={() => onSelect({ kind: 'item', item, sectionTitle })}
      right={right}
    />
  );
}

function ModuleNode({
  module: mod,
  index,
  selectedId,
  onSelect,
  onChanged,
}: {
  module: CurriculumTreeModuleNode;
  index: number;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  onChanged: () => void;
}) {
  const t = useTranslations('Authoring');
  const [expanded, setExpanded] = useState(true);
  const lessonTotal =
    mod.sections.reduce((sum, s) => sum + s.items.length, 0) + mod.ungroupedItems.length;
  const sectionOptions = mod.sections.map((s) => ({ id: s.id, title: s.title }));

  return (
    <>
      <TreeRow
        depth={1}
        expandable
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        icon={
          <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-muted text-[11px] font-extrabold text-muted-foreground">
            {index + 1}
          </span>
        }
        label={mod.title ?? ''}
        sub={mod.titleEn}
        meta={t('structure.lessonCount', { count: lessonTotal })}
        state={null}
        selected={selectedId === mod.id}
        onSelect={() => onSelect({ kind: 'module', module: mod })}
      />
      {expanded && (
        <>
          {mod.sections.map((section) => (
            <div key={section.id}>
              <div className="pt-1.5 pb-0.5" style={{ paddingLeft: 8 + 2 * 20 + 22 }}>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {section.title}
                </span>
              </div>
              {section.items.length === 0 ? (
                <div className="pb-1.5 pt-0" style={{ paddingLeft: 8 + 2 * 20 + 22 }}>
                  <span className="text-xs italic text-muted-foreground">
                    {t('structure.noLessonsYet')}
                  </span>
                </div>
              ) : (
                <CurriculumSectionItems module={mod} items={section.items} onReordered={onChanged}>
                  {(item) => (
                    <ItemRow
                      item={item}
                      sectionTitle={section.title}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      right={
                        sectionOptions.length > 0 ? (
                          <MoveToSectionSelect
                            moduleContainerId={mod.containerId}
                            item={item}
                            currentSectionId={section.id}
                            sections={sectionOptions}
                            onMoved={onChanged}
                          />
                        ) : undefined
                      }
                    />
                  )}
                </CurriculumSectionItems>
              )}
            </div>
          ))}
          {mod.ungroupedItems.length > 0 && (
            <CurriculumSectionItems module={mod} items={mod.ungroupedItems} onReordered={onChanged}>
              {(item) => (
                <ItemRow
                  item={item}
                  sectionTitle={null}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  right={
                    sectionOptions.length > 0 ? (
                      <MoveToSectionSelect
                        moduleContainerId={mod.containerId}
                        item={item}
                        currentSectionId={null}
                        sections={sectionOptions}
                        onMoved={onChanged}
                      />
                    ) : undefined
                  }
                />
              )}
            </CurriculumSectionItems>
          )}
        </>
      )}
    </>
  );
}

export function CurriculumTree({ tree, selectedId, onSelect, onChanged }: CurriculumTreeProps) {
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});

  return (
    <div role="tree" className="flex flex-col gap-px">
      {tree.levels.map((level, li) => {
        const levelKey = level.id ?? `level-${li}`;
        const expanded = expandedLevels[levelKey] ?? true;
        return (
          <div key={levelKey}>
            <TreeRow
              depth={0}
              expandable
              expanded={expanded}
              onToggle={() =>
                setExpandedLevels((prev) => ({ ...prev, [levelKey]: !expanded }))
              }
              icon={<Layers size={16} className="text-muted-foreground" />}
              label={level.title ?? ''}
              state={null}
              selected={selectedId === level.id}
              onSelect={() => onSelect({ kind: 'level', level })}
            />
            {expanded &&
              level.modules.map((mod, mi) => (
                <ModuleNode
                  key={mod.id}
                  module={mod}
                  index={mi}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onChanged={onChanged}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
