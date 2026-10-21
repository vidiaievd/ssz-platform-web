import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { NavigationHistoryTracker } from '@/components/shared/navigation-history-tracker';
import { QueryProvider } from '@/lib/query/provider';
import { routing } from '@/lib/i18n/routing';
import { GLOBAL_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';
import { siteUrl } from '@/lib/seo';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/*
  Defaults every page inherits. Canonical and `hreflang` links are not set here: a layout's
  `alternates` would point every page at the same root, so each public page sets its own.
*/
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const [common, home] = await Promise.all([
    getTranslations({ locale, namespace: 'Common' }),
    getTranslations({ locale, namespace: 'Home' }),
  ]);
  const appName = common('appName');

  return {
    metadataBase: siteUrl(),
    title: { default: appName, template: `%s · ${appName}` },
    description: home('heroSubheadline'),
    applicationName: appName,
    openGraph: {
      type: 'website',
      siteName: appName,
      locale,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, GLOBAL_NAMESPACES)}>
      <ThemeProvider>
        <QueryProvider>
          <NavigationHistoryTracker />
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
