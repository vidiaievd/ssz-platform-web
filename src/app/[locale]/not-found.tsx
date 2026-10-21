import { getTranslations } from 'next-intl/server';
import { SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

/**
 * Localised 404. Rendered for every `notFound()` under `[locale]` and, via the
 * `[...rest]` catch-all, for addresses that match no route.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations('Errors');

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-(--ssz-bg-muted)">
          <SearchX className="size-6 text-(--ssz-text-muted)" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-(--ssz-text-primary)">
            {t('not_found_title')}
          </h1>
          <p className="text-sm text-(--ssz-text-muted)">{t('not_found_body')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">{t('go_home')}</Link>
        </Button>
      </div>
    </main>
  );
}
