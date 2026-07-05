import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE } from './config';
import { loadMessages } from './messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
