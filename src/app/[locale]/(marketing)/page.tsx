import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('Home');
  const tCommon = useTranslations('Common');

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{tCommon('appName')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('tagline')}</p>
      </div>
    </main>
  );
}
