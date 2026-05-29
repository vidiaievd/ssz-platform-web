import { getTranslations } from 'next-intl/server';

import { UserRegisterForm } from '@/features/auth/components/user-register-form';

export default async function RegisterSchoolPage() {
  const t = await getTranslations('Auth.RegisterSchool');

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>
      <UserRegisterForm role="school_admin" />
    </div>
  );
}
