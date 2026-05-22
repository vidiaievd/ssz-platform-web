'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

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

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ContainerOverview({ container }: { container: Container }) {
  const t = useTranslations('Authoring');
  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <InfoRow label={t('fields.type')}>{t(`types.${container.type}`)}</InfoRow>
      <InfoRow label={t('fields.targetLanguage')}>
        {container.targetLanguage.toUpperCase()}
      </InfoRow>
      {container.instructionLanguage && (
        <InfoRow label={t('fields.instructionLanguage')}>
          {container.instructionLanguage.toUpperCase()}
        </InfoRow>
      )}
      {container.level && <InfoRow label={t('fields.level')}>{container.level}</InfoRow>}
      <InfoRow label={t('fields.slug')}>
        <span className="font-mono text-xs">{container.slug}</span>
        {container.isPublished && (
          <Badge variant="muted" className="ml-2 align-middle text-[10px]">
            {t('fields.slugFrozen')}
          </Badge>
        )}
      </InfoRow>
      <InfoRow label={t('fields.accessTier')}>
        {t(`accessTier.${container.accessTier}`)}
        <p className="text-muted-foreground mt-0.5 text-xs">{t('fields.accessTierHint')}</p>
      </InfoRow>
    </dl>
  );
}

function PlaceholderTab() {
  const t = useTranslations('Authoring');
  return <p className="text-muted-foreground py-10 text-center text-sm">{t('comingSoon')}</p>;
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
        <ContainerOverview container={container} />
      </TabsContent>
      <TabsContent value="lessons">
        <PlaceholderTab />
      </TabsContent>
      <TabsContent value="vocabulary">
        <PlaceholderTab />
      </TabsContent>
      <TabsContent value="grammar">
        <PlaceholderTab />
      </TabsContent>
      <TabsContent value="exercises">
        <PlaceholderTab />
      </TabsContent>
      <TabsContent value="tags">
        <PlaceholderTab />
      </TabsContent>
      <TabsContent value="sharing">
        <PlaceholderTab />
      </TabsContent>
    </Tabs>
  );
}
