import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

export default async function NewContainerPage() {
  const t = await getTranslations('Authoring');

  return (
    <main className="max-w-2xl p-8">
      <Button variant="ghost" size="sm" className="-ml-2 mb-6" asChild>
        <Link href="/school/content">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('backToContent')}
        </Link>
      </Button>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{t('new.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('new.subtitle')}</p>
      </div>
      {/* ContainerForm will be wired in Step 9.3 */}
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground text-sm">{t('comingSoon')}</p>
      </div>
    </main>
  );
}
