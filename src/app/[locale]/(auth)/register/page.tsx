import { getTranslations } from 'next-intl/server';

import { RegisterForm } from '@/features/auth/components/register-form';

export default async function RegisterPage() {
  const t = await getTranslations('Auth.Register');

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>
      <RegisterForm />
    </div>
  );
}
