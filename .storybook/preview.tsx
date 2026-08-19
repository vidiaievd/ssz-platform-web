import type { Preview } from '@storybook/nextjs-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    // Every route in this app is App Router, so the router mock has to be mounted for
    // every story: a component that calls `useRouter` — directly or through next-intl's
    // navigation — throws "app router to be mounted" without it, and that is a story
    // failing on its surroundings rather than on itself.
    nextjs: { appDirectory: true },
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
    /*
      A fresh client per story, and no retries.
      Components deep in a screen call `useQuery` without knowing they are in a story, and
      a missing provider fails them on their surroundings rather than on themselves. New
      per story so that one story's cache is never another's starting point; retries off
      so that a story whose fetch goes nowhere fails at once instead of after backoff.
    */
    (Story) => (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Story />
      </QueryClientProvider>
    ),
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
