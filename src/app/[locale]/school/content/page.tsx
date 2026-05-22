import { getTranslations } from 'next-intl/server';

import { MyContainersList } from '@/features/content-authoring/components/my-containers-list';

export default async function SchoolContentPage() {
  const t = await getTranslations('Authoring');

  return (
    <main className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{t('page.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('page.subtitle')}</p>
      </div>
      <MyContainersList />
    </main>
  );
}
