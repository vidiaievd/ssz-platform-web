'use client';

import { ClipboardList, Layers, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { getLessonTypeDefinition } from '@/lib/content/lesson-types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import { ContainerStateBadge } from './container-state-badge';

interface CurriculumInspectorProps {
  selection: CurriculumTreeSelection | null;
}

function InspectorField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

export function CurriculumInspector({ selection }: CurriculumInspectorProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');

  if (!selection) {
    return (
      <div className="flex flex-col items-center gap-2.5 px-5 py-10 text-center text-muted-foreground">
        <ClipboardList size={26} />
        <p className="text-sm">{t('structure.emptySelection')}</p>
      </div>
    );
  }

  if (selection.kind === 'level') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-muted">
            <Layers size={17} className="text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('structure.level')}
            </div>
            <div className="truncate text-[15px] font-bold text-foreground">
              {selection.level.title}
            </div>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('structure.levelHelp')}</p>
      </div>
    );
  }

  if (selection.kind === 'module') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-muted">
            <BookOpen size={17} className="text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('structure.module')}
            </div>
            <div className="truncate text-[15px] font-bold text-foreground">
              {selection.module.title}
            </div>
          </div>
        </div>
        {selection.module.titleEn && (
          <InspectorField label={t('structure.titleEn')} value={selection.module.titleEn} />
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">{t('structure.moduleHelp')}</p>
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
    </div>
  );
}
