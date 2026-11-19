import { getTranslations } from 'next-intl/server';
import { Archive } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

/**
 * "School unavailable" (plan 90, Q13). Organization answers 404 for a closed school to everyone
 * but its owner, and 404 is also the answer for a school that is not yours or does not exist —
 * so the text names the possibilities instead of claiming one.
 */
export async function SchoolUnavailable() {
  const t = await getTranslations('SchoolLifecycle.unavailable');

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-(--ssz-bg-muted)">
          <Archive className="size-6 text-(--ssz-text-muted)" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
          <p className="text-sm text-(--ssz-text-muted)">{t('body')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </main>
  );
}
