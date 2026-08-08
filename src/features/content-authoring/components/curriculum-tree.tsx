'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Copy, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import type {
  AccessTier,
  ContainerPublishState,
  CurriculumTree as CurriculumTreeData,
  CurriculumTreeItemNode,
  CurriculumTreeLevelNode,
  CurriculumTreeModuleNode,
  CurriculumTreeSectionNode,
  DifficultyLevel,
  Visibility,
} from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import {
  isFiltering,
  matchesFilters,
  moduleItems,
  type StructureFilters,
} from '../lib/structure-filters';
import {
  levelCollapseKey,
  levelDomId,
  moduleCode,
  moduleCollapseKey,
  rollUpLevelPublishState,
} from '../lib/structure-nodes';
import { createModuleAction } from '../actions/container';
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
import { StubIconButton } from './stub-controls';

type ChangeKind = 'level' | 'module' | 'item';

const EMPTY_KEYS: ReadonlySet<string> = new Set();

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
  /** Needed to link a block row straight to its editor. */
  schoolSlug: string;
  /**
   * Collapse keys (see `lib/structure-nodes`) of the nodes currently folded.
   * Owned by the shell so the topbar's Expand/Collapse all can drive it; a key
   * absent from the set means expanded, which is the default for a new node.
   */
  collapsed: ReadonlySet<string>;
  onToggleCollapse: (key: string) => void;
  /** Narrows which blocks are shown. Levels and modules are never hidden by it. */
  filters: StructureFilters;
}

/**
 * The localised name of a block's material kind. Needed in two places — the row
 * shows it, and the search matches against it — so it is resolved once here
 * rather than duplicating the registry lookup.
 */
function useMaterialLabel() {
  const tContent = useTranslations('Content');
  return (item: CurriculumTreeItemNode) =>
    tContent(
      `materialType.${getLessonTypeDefinition(getMaterialKind(item)).kind}` as 'materialType.text',
    );
}

// ── shared pieces ────────────────────────────────────────────────────────────

/** Rotates rather than swapping glyphs, so collapsing reads as one motion. */
function Caret({ expanded, onToggle, label }: { expanded: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ transform: expanded ? undefined : 'rotate(-90deg)' }}
    >
      <ChevronDown size={14} />
    </button>
  );
}

/** Small square badge carrying a level index, a module code, or a material glyph. */
function Glyph({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        'flex size-5.5 shrink-0 items-center justify-center rounded-xs text-[10px] font-bold',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

function SectionLabel({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      <span>{title}</span>
      <i className="h-px flex-1 bg-border" />
      {right}
    </div>
  );
}

/**
 * Per-row actions. Hidden at rest and revealed on hover or selection: at four
 * tools per row and a hundred rows in a course, showing them always is what
 * made the old screen unreadable.
 */
function RowTools({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-0.5 transition-opacity',
        visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}
    >
      {children}
    </span>
  );
}

/** Bare ＋ on a section label, where a dashed pill would outweigh the label itself. */
function AddIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus size={12} />
    </button>
  );
}

const TOOL_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Dashed "＋ …" affordance used everywhere something can be added inline. */
function AddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-6.5 items-center gap-1.5 rounded-sm border border-dashed border-(--ssz-border-strong) px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-solid hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <Plus size={12} />
      {label}
    </button>
  );
}

// ── block row ────────────────────────────────────────────────────────────────

function BlockRow({
  item,
  sectionTitle,
  selectedId,
  onSelect,
  schoolSlug,
  courseContainerId,
  right,
}: {
  item: CurriculumTreeItemNode;
  sectionTitle: string | null;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  schoolSlug: string;
  courseContainerId: string;
  right?: React.ReactNode;
}) {
  const t = useTranslations('Authoring');
  const materialLabel = useMaterialLabel();
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;
  const selected = selectedId === item.id;

  return (
    <div
      role="treeitem"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect({ kind: 'item', item, sectionTitle })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect({ kind: 'item', item, sectionTitle });
        }
      }}
      className={cn(
        'group mb-0.75 flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.25 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary-200 bg-primary-50 dark:bg-primary-900/30'
          : 'border-transparent bg-surface hover:border-border',
      )}
    >
      <Glyph style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}>
        <Icon size={12} style={{ color: `var(${def.hueVar})` }} />
      </Glyph>
      <span className="truncate text-sm text-foreground">{item.title}</span>
      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
        {materialLabel(item)}
      </span>
      {item.durationMinutes != null && (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {item.durationMinutes} min
        </span>
      )}
      <ItemChangeBadge item={item} />
      <span className="flex-1" />
      {right}
      <RowTools visible={selected}>
        <Link
          href={`/school/${schoolSlug}/content/${courseContainerId}/lessons/${item.id}`}
          aria-label={t('structure.openLessonEditor')}
          onClick={(e) => e.stopPropagation()}
          className={TOOL_BUTTON}
        >
          <Pencil size={13} />
        </Link>
        <StubIconButton icon={<Copy size={13} />} label={t('structure.duplicate')} />
      </RowTools>
    </div>
  );
}

// ── module card (a sub-lesson) ───────────────────────────────────────────────

function ModuleCard({
  module: mod,
  code,
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
  schoolSlug,
  filters,
  matches,
  expanded,
  onToggleExpanded,
}: {
  module: CurriculumTreeModuleNode;
  code: string;
  schoolSlug: string;
  filters: StructureFilters;
  /** Shared with the tree so a module's rows and its own expansion agree on what matches. */
  matches: (item: CurriculumTreeItemNode) => boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
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
  const [addLessonIn, setAddLessonIn] = useState<string | null | undefined>(undefined);
  const selected = selectedId === mod.id;
  const filtering = isFiltering(filters);
  const visible = (items: CurriculumTreeItemNode[]) => items.filter(matches);

  const allItems = [...mod.sections.flatMap((s) => s.items), ...mod.ungroupedItems];
  const minutes = allItems.reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0);
  const sectionOptions = mod.sections.map((s) => ({ id: s.id, title: s.title }));

  function renderItems(section: CurriculumTreeSectionNode | null) {
    const items = visible(section ? section.items : mod.ungroupedItems);
    if (items.length === 0) {
      return (
        <p className="px-2 py-1 text-xs italic text-muted-foreground">
          {t('structure.noLessonsYet')}
        </p>
      );
    }
    return (
      <CurriculumSectionItems module={mod} items={items} onReordered={onChanged}>
        {(item) => (
          <BlockRow
            item={item}
            sectionTitle={section?.title ?? null}
            selectedId={selectedId}
            onSelect={onSelect}
            schoolSlug={schoolSlug}
            courseContainerId={mod.containerId}
            right={
              sectionOptions.length > 0 ? (
                <MoveToSectionSelect
                  moduleContainerId={mod.containerId}
                  item={item}
                  currentSectionId={section?.id ?? null}
                  sections={sectionOptions}
                  onMoved={onChanged}
                />
              ) : undefined
            }
          />
        )}
      </CurriculumSectionItems>
    );
  }

  return (
    <article className="mt-2 overflow-hidden rounded-sm border border-border">
      <header
        role="treeitem"
        aria-selected={selected}
        aria-expanded={expanded}
        tabIndex={0}
        onClick={() => onSelect({ kind: 'module', module: mod })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect({ kind: 'module', module: mod });
          }
        }}
        className={cn(
          'group flex cursor-pointer items-center gap-2 p-2 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'bg-primary-50 shadow-[inset_3px_0_0_var(--ssz-color-primary-500)] dark:bg-primary-900/30'
            : 'bg-surface hover:bg-subtle',
        )}
      >
        <Caret
          expanded={expanded}
          onToggle={onToggleExpanded}
          label={expanded ? 'Collapse' : 'Expand'}
        />
        <Glyph className="bg-muted text-muted-foreground">{code}</Glyph>
        <span className="truncate text-sm font-semibold text-foreground">{mod.title}</span>
        {mod.titleEn && (
          <span className="truncate text-xs text-muted-foreground">{mod.titleEn}</span>
        )}
        <span className="flex-1" />
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {t('structure.lessonCount', { count: allItems.length })}
          {minutes > 0 && ` · ${t('structure.minutes', { count: minutes })}`}
        </span>
        <PublishStateBadge state={mod.publishState} />
        <MoveModule
          courseContainerId={courseContainerId}
          tree={tree}
          level={level}
          module={mod}
          onMoved={onChanged}
        />
        <RowTools visible={selected}>
          <button
            type="button"
            aria-label={t('structure.addLessonTo', { name: mod.title ?? '' })}
            onClick={(e) => {
              e.stopPropagation();
              setAddLessonIn(null);
            }}
            className={TOOL_BUTTON}
          >
            <Plus size={13} />
          </button>
          <StubIconButton icon={<Copy size={13} />} label={t('structure.duplicate')} />
        </RowTools>
      </header>

      {expanded && (
        <div className="border-t border-dashed border-border bg-(--ssz-bg-base) px-2 pb-3 pl-3 pt-1">
          {mod.sections.map((section) => {
            // While filtering, a section with no matches disappears; unfiltered
            // it stays and says it is empty, because an empty section is a fact
            // about the course and a filtered-out one is not.
            if (filtering && visible(section.items).length === 0) return null;
            return (
            <div key={section.id}>
              <SectionLabel
                title={section.title}
                right={
                  <>
                    {mod.sections.length > 1 && (
                      <MoveSection
                        moduleContainerId={mod.containerId}
                        sections={mod.sections}
                        section={section}
                        onMoved={onChanged}
                      />
                    )}
                    <AddIconButton
                      label={t('structure.addLessonToSection', { section: section.title })}
                      onClick={() => setAddLessonIn(section.id)}
                    />
                  </>
                }
              />
              {renderItems(section)}
            </div>
            );
          })}

          {visible(mod.ungroupedItems).length > 0 && (
            <div className="mt-2">{renderItems(null)}</div>
          )}

          {mod.sections.length === 0 && mod.ungroupedItems.length === 0 && (
            <p className="mt-2 rounded-sm border border-dashed border-(--ssz-border-strong) p-5 text-center text-xs text-muted-foreground">
              {t('structure.noLessonsYet')}
            </p>
          )}

          {filtering && allItems.length > 0 && visible(allItems).length === 0 && (
            <p className="mt-2 rounded-sm border border-dashed border-(--ssz-border-strong) p-5 text-center text-xs text-muted-foreground">
              {t('toolbar.noMatchesInModule')}
            </p>
          )}

          <div className="mt-2">
            <AddButton label={t('structure.addLesson')} onClick={() => setAddLessonIn(null)} />
          </div>
        </div>
      )}

      <AddLessonPicker
        open={addLessonIn !== undefined}
        onOpenChange={(open) => {
          if (!open) setAddLessonIn(undefined);
        }}
        moduleContainerId={mod.containerId}
        sectionId={addLessonIn ?? null}
        targetLanguage={targetLanguage}
        difficultyLevel={difficultyLevel}
        visibility={visibility}
        ownerSchoolId={ownerSchoolId}
        onCreated={(itemId) => {
          setAddLessonIn(undefined);
          onChanged(itemId);
        }}
      />
    </article>
  );
}

// ── tree ─────────────────────────────────────────────────────────────────────

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
  schoolSlug,
  collapsed,
  onToggleCollapse,
  filters,
}: CurriculumTreeProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();
  const [pendingLevelId, setPendingLevelId] = useState<string | null>(null);
  /** Which of the edited module's own sections the picker is filing into. */
  const [addOwnLessonIn, setAddOwnLessonIn] = useState<string | null>(null);
  const editingModule = tree.containerType === 'module';

  const materialLabel = useMaterialLabel();
  const filtering = isFiltering(filters);
  const matches = (item: CurriculumTreeItemNode) =>
    matchesFilters(item, filters, materialLabel(item));
  const moduleMatches = (mod: CurriculumTreeModuleNode) => moduleItems(mod).some(matches);
  const levelMatches = (level: CurriculumTreeLevelNode) =>
    level.modules.some(moduleMatches) || level.items.some(matches);

  /**
   * A search is a question about the whole course, so the tree answers it by
   * opening what holds an answer and folding away what does not — including
   * nodes the author had left open. Their own collapse state is untouched
   * underneath and comes back the moment the filters are cleared.
   */
  const filterSignature = `${filters.query}|${filters.type}|${filters.state}`;
  const [overrides, setOverrides] = useState<{ signature: string; keys: ReadonlySet<string> }>({
    signature: filterSignature,
    keys: new Set(),
  });
  // Overrides belong to the query that produced them. Comparing signatures
  // discards stale ones on the next render, with no effect to reset them.
  const filterOverrides = overrides.signature === filterSignature ? overrides.keys : EMPTY_KEYS;

  function isExpanded(key: string, hasMatches: boolean) {
    if (!filtering) return !collapsed.has(key);
    // A caret must still work while filtering, so a manual toggle flips the
    // derived answer for that node until the query changes again.
    return filterOverrides.has(key) ? !hasMatches : hasMatches;
  }

  function toggleExpanded(key: string) {
    if (!filtering) {
      onToggleCollapse(key);
      return;
    }
    const next = new Set(filterOverrides);
    if (!next.delete(key)) next.add(key);
    setOverrides({ signature: filterSignature, keys: next });
  }

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

  return (
    <div role="tree">
      {tree.levels.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('structure.empty')}</p>
      )}

      {tree.levels.map((level, levelIndex) => {
        const levelKey = levelCollapseKey(level);
        const expanded = isExpanded(levelKey, levelMatches(level));
        const selected = selectedId === level.id;
        const rolledUp: ContainerPublishState | null = rollUpLevelPublishState(level);
        const blockCount = level.modules.reduce(
          (sum, m) => sum + m.sections.reduce((n, s) => n + s.items.length, 0) + m.ungroupedItems.length,
          0,
        );

        return (
          // The rail scrolls here by id; the anchor sits on the wrapper so the
          // level's modules come into view with it.
          <section
            key={levelKey}
            id={levelDomId(level)}
            className="mb-3 scroll-mt-4 overflow-hidden rounded-md border border-border bg-surface"
          >
            <header
              role="treeitem"
              aria-selected={selected}
              aria-expanded={expanded}
              tabIndex={0}
              onClick={() => onSelect({ kind: 'level', level })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect({ kind: 'level', level });
                }
              }}
              className={cn(
                'group flex cursor-pointer items-center gap-2 p-3 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'bg-primary-50 shadow-[inset_3px_0_0_var(--ssz-color-primary-500)] dark:bg-primary-900/30'
                  : 'bg-subtle hover:bg-muted',
              )}
            >
              <Caret
                expanded={expanded}
                onToggle={() => toggleExpanded(levelKey)}
                label={expanded ? 'Collapse' : 'Expand'}
              />
              <Glyph className="bg-primary-100 text-primary-700">{levelIndex + 1}</Glyph>
              <span className="truncate text-sm font-bold tracking-tight text-foreground">
                {level.title}
              </span>
              {rolledUp && <PublishStateBadge state={rolledUp} />}
              <span className="flex-1" />
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {t('structure.moduleCount', { count: level.modules.length })}
                {` · ${t('structure.lessonCount', { count: blockCount })}`}
              </span>
              {level.id != null && tree.levels.length > 1 && (
                <MoveLevel
                  courseContainerId={courseContainerId}
                  levels={tree.levels}
                  level={level}
                  onMoved={onChanged}
                />
              )}
              <RowTools visible={selected}>
                <button
                  type="button"
                  disabled={isPending}
                  aria-label={
                    editingModule
                      ? t('structure.addLessonTo', { name: level.title ?? '' })
                      : t('structure.addModuleTo', { name: level.title ?? '' })
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingModule) setAddOwnLessonIn(level.id ?? '');
                    else handleAddModule(level.id);
                  }}
                  className={TOOL_BUTTON}
                >
                  <Plus size={13} />
                </button>
              </RowTools>
            </header>

            {expanded && (
              <div className="px-3 pb-3 pl-4 pt-2">
                {level.modules.length === 0 && level.items.length === 0 && !editingModule && (
                  <p className="rounded-md border border-dashed border-(--ssz-border-strong) p-6 text-center text-sm text-muted-foreground">
                    {t('structure.noModulesYet')}
                  </p>
                )}

                {level.modules.map((mod, mi) => (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    code={moduleCode(levelIndex, mi)}
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
                    schoolSlug={schoolSlug}
                    filters={filters}
                    matches={matches}
                    expanded={isExpanded(moduleCollapseKey(mod), moduleMatches(mod))}
                    onToggleExpanded={() => toggleExpanded(moduleCollapseKey(mod))}
                  />
                ))}

                {/* Material attached to the edited container itself. A module
                    holds its lessons and exercises here, and the same screen
                    edits modules and courses alike. */}
                {level.items.length > 0 && (
                  <div className="mt-2">
                    {level.items.map((item) => (
                      <BlockRow
                        key={item.id}
                        item={item}
                        sectionTitle={level.title}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        schoolSlug={schoolSlug}
                        courseContainerId={courseContainerId}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-2">
                  {/* A course is built from modules; a module is built from
                      material. The same screen edits both, and it used to offer
                      "Add module" either way — leaving a module editable only
                      from its parent course. */}
                  {editingModule ? (
                    <AddButton
                      label={t('structure.addLesson')}
                      onClick={() => setAddOwnLessonIn(level.id ?? '')}
                    />
                  ) : (
                    <AddButton
                      label={t('structure.addModule')}
                      disabled={isPending}
                      onClick={() => handleAddModule(level.id)}
                    />
                  )}
                  {pendingLevelId === (level.id ?? '') && (
                    <span className="ml-2 text-xs text-muted-foreground">…</span>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {tree.ungroupedItems.map((item) => (
        <BlockRow
          key={item.id}
          item={item}
          sectionTitle={null}
          selectedId={selectedId}
          onSelect={onSelect}
          schoolSlug={schoolSlug}
          courseContainerId={courseContainerId}
        />
      ))}

      {/* A module with no sections has no level row to hang the picker off,
          and its material has to be reachable from somewhere. Once it has
          sections, adding goes through them — a second, section-less entry
          point would just scatter material. */}
      {editingModule && tree.levels.length === 0 && (
        <div className="pt-1">
          <AddButton label={t('structure.addLesson')} onClick={() => setAddOwnLessonIn('')} />
        </div>
      )}

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
