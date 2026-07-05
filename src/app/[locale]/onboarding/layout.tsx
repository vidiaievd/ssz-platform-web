import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { GLOBAL_NAMESPACES, ONBOARDING_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...ONBOARDING_NAMESPACES])}
    >
      <div className="min-h-dvh bg-(--ssz-bg-base)">{children}</div>
    </NextIntlClientProvider>
  );
}
