import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';

import { MarketingNav } from '@/components/shared/marketing-nav';
import { GLOBAL_NAMESPACES, MARKETING_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...MARKETING_NAMESPACES])}
    >
      <div className="flex min-h-screen flex-col bg-(--ssz-bg-base)">
        <MarketingNav />
        <main className="flex-1">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
