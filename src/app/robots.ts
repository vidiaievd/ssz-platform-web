import type { MetadataRoute } from 'next';

import { LOCALES } from '@/lib/i18n/config';
import { siteUrl } from '@/lib/seo';

/*
  Everything behind a sign-in, plus the one-off pages a link in an email leads to. Listed per
  locale rather than with `*` wildcards — not every crawler understands them. No trailing
  slash, so the section's own index is covered too; none of these is a prefix of a public
  route (`/s/<school>` is not caught by `school`).
*/
const PRIVATE_SECTIONS = [
  'account',
  'dev',
  'forgot-password',
  'invite',
  'onboarding',
  'reset-password',
  'school',
  'student',
  'teacher',
  'tutor',
  'verify-email',
  'w',
] as const;

export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl().origin;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          ...LOCALES.flatMap((locale) => PRIVATE_SECTIONS.map((section) => `/${locale}/${section}`)),
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
