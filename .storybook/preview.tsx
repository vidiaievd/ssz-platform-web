import type { Preview } from '@storybook/nextjs-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';

import { loadMessages } from '../src/lib/i18n/messages';
import '../src/styles/globals.css';

const LOCALES = ['en', 'nb', 'uk', 'ru'] as const;

// Per-namespace message files (messages/{locale}/{Namespace}.json) replaced the
// old flat messages/{locale}.json bundles; load through the same loader the
// app uses so Storybook and the app never drift.
const messagesByLocale = Object.fromEntries(
  await Promise.all(LOCALES.map(async (locale) => [locale, await loadMessages(locale)] as const)),
) as Record<(typeof LOCALES)[number], Awaited<ReturnType<typeof loadMessages>>>;

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Locale',
      defaultValue: 'en',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'nb', title: 'Norsk' },
          { value: 'uk', title: 'Українська' },
          { value: 'ru', title: 'Русский' },
        ],
      },
    },
  },
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'error',
    },
  },
  decorators: [
    (Story, ctx) => {
      const locale = ctx.globals.locale as keyof typeof messagesByLocale;
      return (
        <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
          <Story />
        </NextIntlClientProvider>
      );
    },
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
};

export default preview;
