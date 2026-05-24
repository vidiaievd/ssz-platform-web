import type { Preview } from '@storybook/nextjs-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';

import en from '../messages/en.json';
import nb from '../messages/nb.json';
import uk from '../messages/uk.json';
import ru from '../messages/ru.json';
import '../src/styles/globals.css';

const messagesByLocale = { en, nb, uk, ru };

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
