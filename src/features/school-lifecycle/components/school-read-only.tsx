import { getTranslations } from 'next-intl/server';
import { Lock } from 'lucide-react';

/**
 * In place of a page that only creates or changes something, while the workspace is suspended or
 * closed (plan 90, live check, block 9). The banner above it already says why and until when.
 */
export async function SchoolReadOnly() {
  const t = await getTranslations('SchoolLifecycle.readOnly');

  return (
    <main className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-(--ssz-bg-muted)">
          <Lock className="size-6 text-(--ssz-text-muted)" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('body')}</p>
      </div>
    </main>
  );
}
