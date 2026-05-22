'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

import { ContainerForm } from './container-form';
import { ExerciseList } from './exercise-list';
import { GrammarList } from './grammar-list';
import { LessonList } from './lesson-list';
import { PublishDialog } from './publish-dialog';
import { SharingPanel } from './sharing-panel';
import { TagInput } from './tag-input';
import { VocabularyTable } from './vocabulary-table';

type AuthoringTab =
  | 'overview'
  | 'lessons'
  | 'vocabulary'
  | 'grammar'
  | 'exercises'
  | 'tags'
  | 'sharing';

interface AuthoringContainerTabsProps {
  container: Container;
}

export function AuthoringContainerTabs({ container }: AuthoringContainerTabsProps) {
  const t = useTranslations('Authoring');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get('tab') as AuthoringTab | null) ?? 'overview';

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="overflow-x-auto">
        <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
        <TabsTrigger value="lessons">{t('tabs.lessons')}</TabsTrigger>
        <TabsTrigger value="vocabulary">{t('tabs.vocabulary')}</TabsTrigger>
        <TabsTrigger value="grammar">{t('tabs.grammar')}</TabsTrigger>
        <TabsTrigger value="exercises">{t('tabs.exercises')}</TabsTrigger>
        <TabsTrigger value="tags">{t('tabs.tags')}</TabsTrigger>
        <TabsTrigger value="sharing">{t('tabs.sharing')}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <ContainerForm mode="edit" container={container} />
        {!container.isPublished && (
          <div className="mt-6 border-t border-border pt-6">
            <PublishDialog container={container} />
          </div>
        )}
      </TabsContent>
      <TabsContent value="lessons">
        <LessonList container={container} />
      </TabsContent>
      <TabsContent value="vocabulary">
        <VocabularyTable container={container} />
      </TabsContent>
      <TabsContent value="grammar">
        <GrammarList container={container} />
      </TabsContent>
      <TabsContent value="exercises">
        <ExerciseList container={container} />
      </TabsContent>
      <TabsContent value="tags">
        <TagInput entityType="container" entityId={container.id} />
      </TabsContent>
      <TabsContent value="sharing">
        <SharingPanel entityType="container" entityId={container.id} />
      </TabsContent>
    </Tabs>
  );
}
