'use client';

import { useState } from 'react';
import { ClipboardList, Layers, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import type { CurriculumTreeLevelNode, CurriculumTreeModuleNode } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { renameContainerAction } from '../actions/container';
import { renameSectionAction } from '../actions/section';
import { ContainerStateBadge } from './container-state-badge';
import { SaveStatusIndicator } from './save-status-indicator';
import { PanelSaveButton } from './panel-save-button';
import { ModulePublishBlock } from './module-publish-block';

interface CurriculumInspectorProps {
  selection: CurriculumTreeSelection | null;
  /** The course's own container id — levels are sections on it. */
  courseContainerId: string;
  schoolSlug: string;
  /** Called after a rename persists, so the caller can refetch the tree. */
  onChanged: () => void;
}

function InspectorField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground">{value}</div>
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

export function CurriculumInspector({
  selection,
  courseContainerId,
  schoolSlug,
  onChanged,
}: CurriculumInspectorProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');
  const tErrors = useTranslations('Errors');

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
    return (
      <div key={level.id ?? 'single-level'} className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Layers size={17} className="text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('structure.level')}
            </div>
            {level.id ? (
              <TitleField
                value={level.title ?? ''}
                ariaLabel={t('structure.level')}
                onSave={async (title) => {
                  const result = await renameSectionAction(courseContainerId, level.id!, title);
                  if (!result.ok) {
                    toast.error(tErrors(result.error.code));
                    throw new Error(result.error.code);
                  }
                  onChanged();
                }}
              />
            ) : (
              <div className="truncate text-[15px] font-bold text-foreground">{level.title}</div>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('structure.levelHelp')}</p>
      </div>
    );
  }

  if (selection.kind === 'module') {
    const mod: CurriculumTreeModuleNode = selection.module;
    return (
      <div key={mod.id} className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BookOpen size={17} className="text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('structure.module')}
            </div>
            <TitleField
              value={mod.title ?? ''}
              ariaLabel={t('structure.module')}
              onSave={async (title) => {
                const result = await renameContainerAction(mod.containerId, title);
                if (!result.ok) {
                  toast.error(tErrors(result.error.code));
                  throw new Error(result.error.code);
                }
                onChanged();
              }}
            />
          </div>
        </div>
        {mod.titleEn && <InspectorField label={t('structure.titleEn')} value={mod.titleEn} />}
        <p className="text-xs leading-relaxed text-muted-foreground">{t('structure.moduleHelp')}</p>
        {/* Students read a module's own published version, so material added
            here stays invisible until this module — not just the course — is
            published. */}
        <ModulePublishBlock publishState={mod.publishState} />
      </div>
    );
  }

  const { item, sectionTitle } = selection;
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8.5 w-8.5 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}
        >
          <Icon size={17} style={{ color: `var(${def.hueVar})` }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {tContent(`materialType.${def.kind}` as 'materialType.text')}
            {sectionTitle ? ` · ${sectionTitle}` : ''}
          </div>
          <div className="truncate text-[15px] font-bold text-foreground">{item.title}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InspectorField
          label={t('structure.duration')}
          value={item.durationMinutes != null ? `${item.durationMinutes} min` : '—'}
        />
        <InspectorField label={t('structure.xpReward')} value={item.xpReward ?? '—'} />
      </div>

      <InspectorField
        label={t('structure.state')}
        value={item.state ? <ContainerStateBadge state={item.state} /> : '—'}
      />

      <Button asChild variant="outline" size="sm">
        <Link href={`/school/${schoolSlug}/content/${courseContainerId}/lessons/${item.id}`}>
          {t('structure.openLessonEditor')}
        </Link>
      </Button>
    </div>
  );
}
