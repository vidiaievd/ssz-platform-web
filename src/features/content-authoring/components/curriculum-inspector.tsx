'use client';

import { useState } from 'react';
import { ClipboardList, Layers, BookOpen, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import type {
  ContainerPublishState,
  CurriculumTreeItemNode,
  CurriculumTreeLevelNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import { moduleItems } from '../lib/structure-filters';
import { isRenamableItem, type RenamableItemType } from '../lib/renamable-item';
import { rollUpLevelPublishState } from '../lib/structure-nodes';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { useStructureUndo } from '../hooks/use-structure-undo';
import { renameContainerAction, setContainerTitleEnAction } from '../actions/container';
import { renameSectionAction } from '../actions/section';
import { renameItemAction } from '../actions/rename-item';
import { assignItemSectionAction } from '../actions/container-item';
import { ContainerStateBadge } from './container-state-badge';
import { SaveStatusIndicator } from './save-status-indicator';
import { PanelSaveButton } from './panel-save-button';
import { ModulePublishBlock } from './module-publish-block';
import { ItemChangeBadge } from './item-change-badge';
import { ItemLiveBadge } from './item-live-badge';
import { SectionAssignSelect } from './section-assign-select';
import type { DeleteNodeTarget } from './delete-node-dialog';
import {
  STUB_PLACEHOLDERS,
  StubField,
  StubSegmentedField,
  StubSelectField,
  StubSwitchRow,
  StubTextareaField,
} from './stub-controls';

interface CurriculumInspectorProps {
  selection: CurriculumTreeSelection | null;
  /** The course's own container id — levels are sections on it. */
  courseContainerId: string;
  schoolSlug: string;
  /** Called after a rename persists, so the caller can refetch the tree. */
  onChanged: () => void;
  /** Opens the delete confirmation, which the panel owns (`useNodeDeletion`). */
  onDelete: (target: DeleteNodeTarget) => void;
}

function InspectorField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

/** A counted fact about the selected node — the design's `.kv` row. */
function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <b className="font-semibold text-foreground">{value}</b>
    </div>
  );
}

function TitleField({
  value,
  onSave,
  ariaLabel,
}: {
  value: string;
  onSave: (title: string) => Promise<void>;
  ariaLabel: string;
}) {
  const [title, setTitle] = useState(value);
  const unsaved = useUnsavedChanges({ onSave: () => onSave(title) });

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            unsaved.markDirty();
          }}
          aria-label={ariaLabel}
          className="h-8 text-[15px] font-bold"
        />
        <PanelSaveButton unsaved={unsaved} />
      </div>
      <SaveStatusIndicator status={unsaved.status} savedAt={unsaved.savedAt} />
    </div>
  );
}

/** A labelled text field that saves on demand — the same contract as the title. */
function EditableField({
  label,
  saveLabel,
  savedMessage,
  value,
  onSave,
}: {
  label: string;
  /** Distinct from the title's "Save": two identically named buttons in one panel are ambiguous. */
  saveLabel: string;
  savedMessage: string;
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const unsaved = useUnsavedChanges({ onSave: () => onSave(draft) });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            unsaved.markDirty();
          }}
          aria-label={label}
          className="h-8 text-sm"
        />
        <PanelSaveButton unsaved={unsaved} label={saveLabel} successMessage={savedMessage} />
      </div>
      <SaveStatusIndicator status={unsaved.status} savedAt={unsaved.savedAt} />
    </div>
  );
}

/** The kind badge and title that opens every form. */
function InspectorHead({
  icon,
  kindLabel,
  children,
}: {
  icon: React.ReactNode;
  kindLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {kindLabel}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The footer of the design's inspector: open what is selected, or delete it.
 *
 * Deletion is confirmed by the panel's dialog — the same one the row menus use,
 * so the wording about what a level, a module or a block actually loses is
 * written once (`useNodeDeletion`).
 */
function InspectorFooter({ editorHref, onDelete }: { editorHref?: string; onDelete?: () => void }) {
  const t = useTranslations('Authoring');

  if (!editorHref && !onDelete) return null;

  return (
    <div className="flex gap-2 border-t border-border pt-3">
      {editorHref && (
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={editorHref}>{t('structure.openEditor')}</Link>
        </Button>
      )}
      {onDelete && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={14} />
          {t('structure.deleteAction')}
        </Button>
      )}
    </div>
  );
}

/**
 * Where a level sits in the design's three-way segment, read off the modules
 * underneath it: a level is a grouping and has no state of its own. An empty
 * level highlights nothing — with no modules there is nothing to be published.
 */
function levelPublishSegment(level: CurriculumTreeLevelNode): string | null {
  if (level.modules.length === 0) return null;
  const rolled: ContainerPublishState | null = rollUpLevelPublishState(level);
  if (rolled === null) return 'published';
  return rolled === 'pending_changes' ? 'edited' : rolled;
}

/**
 * Where a block sits in the design's three-way segment. Read from liveness
 * rather than from the lesson variant's own status: a variant is published the
 * moment it is saved, while the row placing it can still be invisible.
 */
function itemPublishSegment(item: CurriculumTreeItemNode): string {
  if (!item.isLive) return 'draft';
  return item.pendingChange ? 'edited' : 'published';
}

export function CurriculumInspector({
  selection,
  courseContainerId,
  schoolSlug,
  onChanged,
  onDelete,
}: CurriculumInspectorProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');
  const tErrors = useTranslations('Errors');
  const undo = useStructureUndo();

  const publishOptions = [
    { value: 'draft', label: t('publishState.draft') },
    { value: 'edited', label: t('structure.publishEdited') },
    { value: 'published', label: t('publishState.published') },
  ];

  if (!selection) {
    return (
      <div className="flex flex-col items-center gap-2.5 px-5 py-10 text-center text-muted-foreground">
        <ClipboardList size={26} />
        <p className="text-sm">{t('structure.emptySelection')}</p>
      </div>
    );
  }

  if (selection.kind === 'level') {
    const level: CurriculumTreeLevelNode = selection.level;
    const blockCount =
      level.items.length + level.modules.reduce((sum, mod) => sum + moduleItems(mod).length, 0);

    return (
      <div key={level.id ?? 'single-level'} className="flex flex-col gap-4">
        <InspectorHead
          icon={<Layers size={17} className="text-muted-foreground" />}
          kindLabel={t('structure.level')}
        >
          {level.id ? (
            <TitleField
              value={level.title ?? ''}
              ariaLabel={t('structure.level')}
              onSave={async (title) => {
                const previous = level.title ?? '';
                const result = await renameSectionAction(courseContainerId, level.id!, title);
                if (!result.ok) {
                  toast.error(tErrors(result.error.code));
                  throw new Error(result.error.code);
                }
                undo.record({
                  label: t('undo.renamed', { name: title }),
                  revert: async () =>
                    (await renameSectionAction(courseContainerId, level.id!, previous)).ok,
                });
                onChanged();
              }}
            />
          ) : (
            <div className="truncate text-[15px] font-bold text-foreground">{level.title}</div>
          )}
        </InspectorHead>

        <StubField label={t('structure.subtitle')} value={STUB_PLACEHOLDERS.none} />

        {/* Read from the modules underneath: a level is a grouping and has no
            state of its own, which is also why the segment cannot be used. */}
        <StubSegmentedField
          label={t('structure.publishStateLabel')}
          options={publishOptions}
          activeValue={levelPublishSegment(level)}
        />

        <div>
          <CountRow label={t('metrics.modules')} value={level.modules.length} />
          <CountRow label={t('structure.blocks')} value={blockCount} />
        </div>

        <StubSwitchRow
          label={t('structure.sequentialUnlock')}
          hint={t('structure.sequentialUnlockHint')}
          on
        />

        <p className="text-xs leading-relaxed text-muted-foreground">{t('structure.levelHelp')}</p>

        <InspectorFooter
          onDelete={
            level.id
              ? () =>
                  onDelete({
                    kind: 'level',
                    id: level.id!,
                    title: level.title ?? '',
                    moduleCount: level.modules.length,
                    blockCount,
                  })
              : undefined
          }
        />
      </div>
    );
  }

  if (selection.kind === 'module') {
    const mod: CurriculumTreeModuleNode = selection.module;
    const blocks = moduleItems(mod);
    const estimatedMinutes = blocks.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);

    return (
      <div key={mod.id} className="flex flex-col gap-4">
        <InspectorHead
          icon={<BookOpen size={17} className="text-muted-foreground" />}
          kindLabel={t('structure.module')}
        >
          <TitleField
            value={mod.title ?? ''}
            ariaLabel={t('structure.module')}
            onSave={async (title) => {
              const previous = mod.title ?? '';
              const result = await renameContainerAction(mod.containerId, title);
              if (!result.ok) {
                toast.error(tErrors(result.error.code));
                throw new Error(result.error.code);
              }
              undo.record({
                label: t('undo.renamed', { name: title }),
                revert: async () => (await renameContainerAction(mod.containerId, previous)).ok,
              });
              onChanged();
            }}
          />
        </InspectorHead>

        <div className="grid grid-cols-2 gap-3">
          <StubField label={t('structure.code')} value={STUB_PLACEHOLDERS.code} />
          <InspectorField
            label={t('structure.estMinutes')}
            value={t('structure.minutes', { count: estimatedMinutes })}
          />
        </div>

        {/* The tree's `titleEn` is a container localization row, not a field on
            the module — see `setContainerTitleEnAction`. */}
        <EditableField
          label={t('structure.titleEn')}
          saveLabel={t('structure.saveTitleEn')}
          savedMessage={t('structure.titleEnSaved')}
          value={mod.titleEn ?? ''}
          onSave={async (next) => {
            const previous = mod.titleEn;
            const result = await setContainerTitleEnAction(
              mod.containerId,
              next,
              previous !== null,
            );
            if (!result.ok) {
              toast.error(tErrors(result.error.code));
              throw new Error(result.error.code);
            }
            undo.record({
              label: t('undo.renamed', { name: next }),
              // Whether the localization row exists now is what the save just
              // decided: a non-empty subtitle created or kept it, an empty one
              // deleted it.
              revert: async () =>
                (
                  await setContainerTitleEnAction(
                    mod.containerId,
                    previous ?? '',
                    next.trim() !== '',
                  )
                ).ok,
            });
            onChanged();
          }}
        />

        <div>
          <CountRow label={t('structure.blocks')} value={blocks.length} />
          <CountRow label={t('structure.sections')} value={mod.sections.length} />
        </div>

        <StubTextareaField
          label={t('structure.learningGoals')}
          placeholder={t('structure.learningGoalsPlaceholder')}
        />
        <StubSwitchRow
          label={t('structure.homeworkByDefault')}
          hint={t('structure.homeworkByDefaultHint')}
        />
        <StubSwitchRow
          label={t('structure.includeInSrs')}
          hint={t('structure.includeInSrsHint')}
          on
        />

        <p className="text-xs leading-relaxed text-muted-foreground">{t('structure.moduleHelp')}</p>

        {/* Students read a module's own published version, so material added
            here stays invisible until this module — not just the course — is
            published. Reported rather than offered as a segment: the release
            itself happens in one place, "Review & publish". */}
        <ModulePublishBlock publishState={mod.publishState} />

        <InspectorFooter
          editorHref={`/school/${schoolSlug}/content/${mod.containerId}`}
          onDelete={() =>
            onDelete({
              kind: 'module',
              id: mod.id,
              title: mod.title ?? '',
              blockCount: blocks.length,
            })
          }
        />
      </div>
    );
  }

  const { item, sectionTitle, sectionId, containerId } = selection;
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;
  const materialLabel = tContent(`materialType.${def.kind}` as 'materialType.text');
  const isExercise = item.itemType === 'exercise';

  return (
    <div key={item.id} className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8.5 w-8.5 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}
        >
          <Icon size={17} style={{ color: `var(${def.hueVar})` }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {materialLabel}
            {sectionTitle ? ` · ${sectionTitle}` : ''}
          </div>
          <div className="truncate text-[15px] font-bold text-foreground">{item.title}</div>
        </div>
      </div>

      {/* An exercise row is labelled by its template's name and has no title of
          its own to write to (B8) — which is also why two exercises in a row
          read the same. */}
      {isRenamableItem(item) ? (
        <EditableField
          label={t('structure.titleField')}
          saveLabel={t('form.save')}
          savedMessage={t('structure.titleSaved')}
          value={item.title ?? ''}
          onSave={async (next) => {
            const previous = item.title ?? '';
            const itemType = item.itemType as RenamableItemType;
            const result = await renameItemAction(itemType, item.refId, containerId, next);
            if (!result.ok) {
              toast.error(tErrors(result.error.code));
              throw new Error(result.error.code);
            }
            undo.record({
              label: t('undo.renamed', { name: next }),
              revert: async () =>
                (await renameItemAction(itemType, item.refId, containerId, previous)).ok,
            });
            onChanged();
          }}
        />
      ) : (
        <StubField label={t('structure.titleField')} value={item.title ?? ''} />
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* A row's type is fixed by the material it points at: changing it would
            mean replacing the material, not editing the row. */}
        <StubSelectField label={t('structure.blockType')} value={materialLabel} />
        <InspectorField
          label={t('structure.duration')}
          value={
            item.durationMinutes != null
              ? t('structure.minutes', { count: item.durationMinutes })
              : '—'
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InspectorField label={t('structure.xpReward')} value={item.xpReward ?? '—'} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('structure.sectionField')}
          </span>
          <SectionAssignSelect
            containerId={containerId}
            containerItemId={item.id}
            sectionId={sectionId}
            onChanged={() => {
              undo.record({
                label: t('undo.movedToSection', { name: item.title ?? '' }),
                revert: async () =>
                  (await assignItemSectionAction(containerId, item.id, sectionId)).ok,
              });
              onChanged();
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <StubSegmentedField
          label={t('structure.publishStateLabel')}
          options={publishOptions}
          activeValue={itemPublishSegment(item)}
        />
        {/* The segment cannot say whether a student can open the row *now* —
            that is the question an author actually asks of it. */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          {item.isLive === null ? (
            <ContainerStateBadge state="draft" />
          ) : item.isLive ? (
            <span className="text-xs text-muted-foreground">{t('publishState.itemLive')}</span>
          ) : (
            <ItemLiveBadge isLive={false} />
          )}
          {/* Only what publishing would change about this row. A live row can
              still carry one — it was reordered or made optional since the last
              release. */}
          {item.pendingChange && item.pendingChange !== 'added' && <ItemChangeBadge item={item} />}
        </div>
      </div>

      {isExercise ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StubField label={t('structure.points')} value={STUB_PLACEHOLDERS.points} />
            <StubSelectField
              label={t('structure.attempts')}
              value={t('structure.attemptsUnlimited')}
            />
          </div>
          <StubSwitchRow label={t('structure.autoGrade')} hint={t('structure.autoGradeHint')} on />
          <StubSwitchRow label={t('structure.showHints')} hint={t('structure.showHintsHint')} />
        </>
      ) : (
        <StubSwitchRow
          label={t('structure.visibleToStudents')}
          hint={t('structure.visibleToStudentsHint')}
          on
        />
      )}

      <div className="flex items-center justify-between gap-3 py-0.5 text-xs text-muted-foreground">
        <span>{t('structure.blockId')}</span>
        <b className="truncate font-mono text-[11px] font-semibold text-foreground">{item.id}</b>
      </div>

      <InspectorFooter
        editorHref={`/school/${schoolSlug}/content/${containerId}/lessons/${item.id}`}
        onDelete={() => onDelete({ kind: 'item', id: item.id, title: item.title ?? '' })}
      />
    </div>
  );
}
