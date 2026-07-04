'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Container } from '@/features/content/types';

import { useModuleReadiness, type ModuleSection } from '../hooks/use-module-readiness';
import { ExerciseList } from './exercise-list';
import { GrammarList } from './grammar-list';
import { LessonList } from './lesson-list';
import { ModulePreviewPanel } from './module-preview-panel';
import { SectionReadinessBadge } from './section-readiness-badge';
import { VocabularyTable } from './vocabulary-table';

const SECTIONS: Array<{ key: ModuleSection; labelKey: 'readListen' | 'vocabulary' | 'grammar' | 'practice' }> = [
  { key: 'readListen', labelKey: 'readListen' },
  { key: 'vocabulary', labelKey: 'vocabulary' },
  { key: 'grammar',   labelKey: 'grammar' },
  { key: 'practice',  labelKey: 'practice' },
];

export interface ModuleSectionTabsProps {
  container: Container;
}

export function ModuleSectionTabs({ container }: ModuleSectionTabsProps) {
  const t = useTranslations('Authoring.moduleSections');
  const [activeSection, setActiveSection] = useState<ModuleSection>('readListen');
  const readiness = useModuleReadiness(container.id);

  return (
    <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[1fr_300px]">
      {/* ── Editor pane ── */}
      <Tabs
        value={activeSection}
        onValueChange={(v) => setActiveSection(v as ModuleSection)}
      >
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          {SECTIONS.map(({ key, labelKey }) => (
            <TabsTrigger key={key} value={key} className="inline-flex items-center">
              {t(labelKey)}
              <SectionReadinessBadge {...readiness[key]} />
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="readListen">
          <LessonList container={container} />
        </TabsContent>
        <TabsContent value="vocabulary">
          <VocabularyTable container={container} />
        </TabsContent>
        <TabsContent value="grammar">
          <GrammarList container={container} />
        </TabsContent>
        <TabsContent value="practice">
          <ExerciseList container={container} />
        </TabsContent>
      </Tabs>

      {/* ── Preview pane (sticky, ≥xl only) ── */}
      <div className="sticky top-6 hidden xl:block">
        <ModulePreviewPanel container={container} activeSection={activeSection} />
      </div>
    </div>
  );
}
