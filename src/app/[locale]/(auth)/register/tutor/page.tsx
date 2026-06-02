import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';

import { UserRegisterForm } from '@/features/auth/components/user-register-form';

export default async function RegisterTutorPage() {
  const t = await getTranslations('Auth.RegisterTutor');

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {(['1', '2', '3'] as const).map((n) => (
          <li key={n} className="flex items-center gap-2 text-sm text-(--ssz-text-secondary)">
            <Check className="size-4 shrink-0 text-(--ssz-text-link)" aria-hidden />
            {t(`valueProp.${n}`)}
          </li>
        ))}
      </ul>

      <UserRegisterForm role="tutor" />
    </div>
  );
}
