import type { enMessages } from '@/lib/i18n/messages';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof enMessages;
  }
}
