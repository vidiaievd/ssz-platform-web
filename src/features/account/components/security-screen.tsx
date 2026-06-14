'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SecurityScreen() {
  const t = useTranslations('Account.security');

  return (
    <div className="p-6 md:p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <section className="space-y-4 max-w-xl">
        <h2 className="text-base font-semibold">{t('email')}</h2>
        <Input disabled placeholder="you@example.com" />
        {/* TODO(backend): wire to auth/identity-service change-email flow */}
        <Button variant="outline" disabled>{t('comingSoon')}</Button>
      </section>

      <section className="space-y-4 max-w-xl">
        <h2 className="text-base font-semibold">{t('password')}</h2>
        <Input disabled type="password" placeholder="••••••••" />
        {/* TODO(backend): wire to auth/identity-service change-password flow */}
        <Button variant="outline" disabled>{t('comingSoon')}</Button>
      </section>

      <section className="space-y-4 max-w-xl">
        <h2 className="text-base font-semibold">{t('sessions')}</h2>
        {/* TODO(backend): GET /auth/sessions + DELETE /auth/sessions/{id} */}
        <p className="text-sm text-(--ssz-text-muted)">{t('comingSoon')}</p>
      </section>
    </div>
  );
}
