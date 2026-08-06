'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronRight, Layers, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import type {
  AccessTier,
  ContainerPublishState,
  CurriculumTree as CurriculumTreeData,
  CurriculumTreeItemNode,
  CurriculumTreeLevelNode,
  CurriculumTreeModuleNode,
  DifficultyLevel,
  Visibility,
} from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import { createModuleAction } from '../actions/container';
import { createSectionAction } from '../actions/section';
import { PublishStateBadge } from './publish-state-badge';
import { ItemChangeBadge } from './item-change-badge';
import {
  CurriculumSectionItems,
  MoveLevel,
  MoveModule,
  MoveSection,
  MoveToSectionSelect,
} from './curriculum-item-reorder';
import { AddLessonPicker } from './add-lesson-picker';

type ChangeKind = 'level' | 'module' | 'item';

interface CurriculumTreeProps {
  tree: CurriculumTreeData;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  /** Called after a reorder, section move, or node creation persists, so the caller can refetch the tree (and select the new node, if any). */
  onChanged: (selectId?: string, kind?: ChangeKind) => void;
  /** The course's own container id — levels are sections on it; modules attach to it as `container`-type items. */
  courseContainerId: string;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  accessTier: AccessTier;
  /** The course's owning school — inherited by every node created from the tree. */
  ownerSchoolId?: string | null;
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
  state?: ContainerPublishState | null;
  /** Extra status next to `state` — item liveness, which is not a container state. */
  badge?: React.ReactNode;
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
  badge,
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
      {state && <PublishStateBadge state={state} />}
      {badge}
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
      badge={<ItemChangeBadge item={item} />}
      selected={selectedId === item.id}
      onSelect={() => onSelect({ kind: 'item', item, sectionTitle })}
      right={right}
    />
  );
}

function OwnItemRow({
  item,
  sectionTitle,
  selectedId,
  onSelect,
}: {
  item: CurriculumTreeItemNode;
  sectionTitle: string | null;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
}) {
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;
  return (
    <TreeRow
      depth={1}
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
      badge={<ItemChangeBadge item={item} />}
      selected={selectedId === item.id}
      onSelect={() => onSelect({ kind: 'item', item, sectionTitle })}
    />
  );
}

function ModuleNode({
  module: mod,
  index,
  selectedId,
  onSelect,
  onChanged,
  tree,
  level,
  courseContainerId,
  targetLanguage,
  difficultyLevel,
  visibility,
  ownerSchoolId,
}: {
  module: CurriculumTreeModuleNode;
  index: number;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  onChanged: (selectId?: string, kind?: ChangeKind) => void;
  tree: CurriculumTreeData;
  level: CurriculumTreeLevelNode;
  courseContainerId: string;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  ownerSchoolId?: string | null;
}) {
  const t = useTranslations('Authoring');
  const [expanded, setExpanded] = useState(true);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
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
        state={mod.publishState}
        selected={selectedId === mod.id}
        onSelect={() => onSelect({ kind: 'module', module: mod })}
        right={
          <MoveModule
            courseContainerId={courseContainerId}
            tree={tree}
            level={level}
            module={mod}
            onMoved={onChanged}
          />
        }
      />
      {expanded && (
        <>
          {mod.sections.map((section) => (
            <div key={section.id}>
              <div
                className="flex items-center justify-between pt-1.5 pb-0.5"
                style={{ paddingLeft: 8 + 2 * 20 + 22 }}
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {section.title}
                </span>
                {mod.sections.length > 1 && (
                  <MoveSection
                    moduleContainerId={mod.containerId}
                    sections={mod.sections}
                    section={section}
                    onMoved={onChanged}
                  />
                )}
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
          <div className="pb-1.5 pt-1" style={{ paddingLeft: 8 + 2 * 20 + 22 }}>
            <button
              type="button"
              onClick={() => setAddLessonOpen(true)}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <Plus size={13} />
              {t('structure.addLesson')}
            </button>
          </div>
          <AddLessonPicker
            open={addLessonOpen}
            onOpenChange={setAddLessonOpen}
            moduleContainerId={mod.containerId}
            targetLanguage={targetLanguage}
            difficultyLevel={difficultyLevel}
            visibility={visibility}
            ownerSchoolId={ownerSchoolId}
            onCreated={(itemId) => onChanged(itemId)}
          />
        </>
      )}
    </>
  );
}

export function CurriculumTree({
  tree,
  selectedId,
  onSelect,
  onChanged,
  courseContainerId,
  targetLanguage,
  difficultyLevel,
  visibility,
  accessTier,
  ownerSchoolId,
}: CurriculumTreeProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [pendingLevelId, setPendingLevelId] = useState<string | null>(null);
  /** Which of the edited module's own sections the picker is filing into. */
  const [addOwnLessonIn, setAddOwnLessonIn] = useState<string | null>(null);
  const editingModule = tree.containerType === 'module';

  function handleAddModule(levelSectionId: string | null) {
    if (isPending) return;
    setPendingLevelId(levelSectionId ?? '');
    startTransition(async () => {
      const result = await createModuleAction(
        courseContainerId,
        t('structure.newModuleTitle'),
        targetLanguage,
        difficultyLevel,
        visibility,
        accessTier,
        levelSectionId,
        ownerSchoolId,
      );
      setPendingLevelId(null);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onChanged(result.value.itemId, 'module');
    });
  }

  function handleAddLevel() {
    if (isPending) return;
    startTransition(async () => {
      const result = await createSectionAction(courseContainerId, t('structure.newLevelTitle'));
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onChanged(result.value.sectionId, 'level');
    });
  }

  return (
    <div role="tree" className="flex flex-col gap-px">
      {tree.levels.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('structure.empty')}</p>
      )}
      {tree.levels.map((level, li) => {
        const levelKey = level.id ?? `level-${li}`;
        const expanded = expandedLevels[levelKey] ?? true;
        return (
          <div key={levelKey}>
            <TreeRow
              depth={0}
              expandable
              expanded={expanded}
              onToggle={() => setExpandedLevels((prev) => ({ ...prev, [levelKey]: !expanded }))}
              icon={<Layers size={16} className="text-muted-foreground" />}
              label={level.title ?? ''}
              state={null}
              selected={selectedId === level.id}
              onSelect={() => onSelect({ kind: 'level', level })}
              right={
                level.id != null && tree.levels.length > 1 ? (
                  <MoveLevel
                    courseContainerId={courseContainerId}
                    levels={tree.levels}
                    level={level}
                    onMoved={onChanged}
                  />
                ) : undefined
              }
            />
            {expanded && (
              <>
                {level.modules.map((mod, mi) => (
                  <ModuleNode
                    key={mod.id}
                    module={mod}
                    index={mi}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onChanged={onChanged}
                    tree={tree}
                    level={level}
                    courseContainerId={courseContainerId}
                    targetLanguage={targetLanguage}
                    difficultyLevel={difficultyLevel}
                    visibility={visibility}
                    ownerSchoolId={ownerSchoolId}
                  />
                ))}
                {/* Material attached to the edited container itself. A module
                    holds its lessons and exercises here, and the same screen
                    edits modules and courses alike. */}
                {level.items.map((item) => (
                  <OwnItemRow
                    key={item.id}
                    item={item}
                    sectionTitle={level.title}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                ))}
                <div className="pb-1.5 pt-1" style={{ paddingLeft: 8 + 1 * 20 + 22 }}>
                  {/* A course is built from modules; a module is built from
                      material. The same screen edits both, and it used to offer
                      "Add module" either way — leaving a module editable only
                      from its parent course. */}
                  {editingModule ? (
                    <button
                      type="button"
                      onClick={() => setAddOwnLessonIn(level.id ?? '')}
                      className="flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus size={13} />
                      {t('structure.addLesson')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAddModule(level.id)}
                      className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:opacity-50"
                    >
                      <Plus size={13} />
                      {pendingLevelId === (level.id ?? '') ? '…' : t('structure.addModule')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      {tree.ungroupedItems.map((item) => (
        <OwnItemRow
          key={item.id}
          item={item}
          sectionTitle={null}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
      {/* A module with no sections has no level row to hang the picker off,
          and its material has to be reachable from somewhere. Once it has
          sections, adding goes through them — a second, section-less entry
          point would just scatter material. */}
      {editingModule && tree.levels.length === 0 && (
        <div className="pb-1.5 pt-1" style={{ paddingLeft: 8 + 22 }}>
          <button
            type="button"
            onClick={() => setAddOwnLessonIn('')}
            className="flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={13} />
            {t('structure.addLesson')}
          </button>
        </div>
      )}
      <div className="mt-1 pl-2">
        <Button variant="ghost" size="sm" disabled={isPending} onClick={handleAddLevel}>
          <Plus size={13} />
          {t('structure.addLevel')}
        </Button>
      </div>

      {editingModule && (
        <AddLessonPicker
          open={addOwnLessonIn !== null}
          onOpenChange={(open) => {
            if (!open) setAddOwnLessonIn(null);
          }}
          moduleContainerId={courseContainerId}
          sectionId={addOwnLessonIn || null}
          targetLanguage={targetLanguage}
          difficultyLevel={difficultyLevel}
          visibility={visibility}
          ownerSchoolId={ownerSchoolId}
          onCreated={(itemId) => {
            setAddOwnLessonIn(null);
            onChanged(itemId);
          }}
        />
      )}
    </div>
  );
}
