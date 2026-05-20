import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/features/auth/components/login-form';

export default async function LoginPage() {
  const t = await getTranslations('Auth.Login');

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>
      <LoginForm />
    </div>
  );
}
