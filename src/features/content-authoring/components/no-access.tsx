import { getTranslations } from 'next-intl/server';

/**
 * What a course that is not yours looks like.
 *
 * The editor used to catch only `not_found`, so content-service's 403 arrived as an
 * unhandled throw and the reader was told "Internal server error" — a claim that the
 * platform is broken, when the truth is that this course belongs to somebody else
 * (plan 61, phase 2).
 */
export async function NoAccess() {
  const t = await getTranslations('Errors');

  return (
    <main className="mx-auto w-full max-w-2xl px-8 py-24 text-center">
      <p className="text-muted-foreground text-sm">{t('forbidden')}</p>
    </main>
  );
}
