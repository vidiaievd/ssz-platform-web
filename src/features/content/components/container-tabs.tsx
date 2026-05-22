'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import { LessonsTab } from './lessons-tab';
import { VocabularyTab } from './vocabulary-tab';
import { GrammarTab } from './grammar-tab';
import { ExercisesTab } from './exercises-tab';

type TabKey = 'lessons' | 'vocabulary' | 'grammar' | 'exercises';

interface ContainerTabsClientProps {
  containerId: string;
  versionId?: string;
}

export function ContainerTabsClient({ containerId, versionId }: ContainerTabsClientProps) {
  const t = useTranslations('Content');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get('tab') as TabKey | null) ?? 'lessons';

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="lessons">{t('tabLessons')}</TabsTrigger>
        <TabsTrigger value="vocabulary">{t('tabVocabulary')}</TabsTrigger>
        <TabsTrigger value="grammar">{t('tabGrammar')}</TabsTrigger>
        <TabsTrigger value="exercises">{t('tabExercises')}</TabsTrigger>
      </TabsList>

      <TabsContent value="lessons">
        <LessonsTab containerId={containerId} versionId={versionId} />
      </TabsContent>

      <TabsContent value="vocabulary">
        <VocabularyTab containerId={containerId} versionId={versionId} />
      </TabsContent>

      <TabsContent value="grammar">
        <GrammarTab containerId={containerId} versionId={versionId} />
      </TabsContent>

      <TabsContent value="exercises">
        <ExercisesTab containerId={containerId} versionId={versionId} />
      </TabsContent>
    </Tabs>
  );
}
