import type { MetadataRoute } from 'next';

import { listPublicSchools } from '@/features/discovery/api/get-schools.server';
import { LOCALES } from '@/lib/i18n/config';
import { languageAlternates, localePath, siteUrl } from '@/lib/seo';

// Schools open and close their public pages; an hour behind is close enough for a crawler.
export const revalidate = 3600;

/*
  Only what an anonymous visitor can open. A catalogue course page asks for a sign-in, so the
  catalogue is listed, its courses are not.
*/
const STATIC_PATHS = ['/', '/discover', '/catalogue'] as const;

function entriesFor(path: string, priority: number): MetadataRoute.Sitemap {
  const origin = siteUrl().origin;
  const languages = languageAlternates(path, true);
  return LOCALES.map((locale) => ({
    url: origin + localePath(locale, path),
    changeFrequency: 'weekly',
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = STATIC_PATHS.flatMap((path) => entriesFor(path, path === '/' ? 1 : 0.8));

  // organization-service down must not take the whole sitemap with it — the static part stands.
  let schoolSlugs: string[] = [];
  try {
    schoolSlugs = (await listPublicSchools()).map((school) => school.schoolSlug);
  } catch {
    schoolSlugs = [];
  }

  return [
    ...entries,
    ...schoolSlugs.flatMap((slug) => entriesFor(`/s/${encodeURIComponent(slug)}`, 0.6)),
  ];
}
