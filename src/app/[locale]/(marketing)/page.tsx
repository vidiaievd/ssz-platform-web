import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    const locale = await getLocale();
    const isMgmt = user.roles.some((r) => r === 'school' || r === 'tutor');
    redirect(`/${locale}${isMgmt ? '/school/dashboard' : '/student/dashboard'}`);
  }

  const t = await getTranslations('Home');
  const tCommon = await getTranslations('Common');

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{tCommon('appName')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('tagline')}</p>
      </div>
    </main>
  );
}
