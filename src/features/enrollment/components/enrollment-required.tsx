import { School } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

export async function EnrollmentRequired() {
  const t = await getTranslations('EnrollmentRequired');

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent">
        <School className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-(--ssz-text-primary)">{t('title')}</h2>
      <p className="mt-2 max-w-sm text-sm text-(--ssz-text-secondary)">{t('description')}</p>
      <Button asChild variant="primary" className="mt-6">
        <Link href="/student/discover">{t('cta')}</Link>
      </Button>
    </div>
  );
}
