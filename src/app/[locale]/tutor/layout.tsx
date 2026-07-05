import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { GLOBAL_NAMESPACES, SCHOOL_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...SCHOOL_NAMESPACES])}
    >
      {children}
    </NextIntlClientProvider>
  );
}
