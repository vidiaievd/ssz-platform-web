import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Globe, MapPin, Mail } from 'lucide-react';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) return {};

  return {
    title: school.name,
    description: school.description ?? undefined,
    openGraph: {
      title: school.name,
      description: school.description ?? undefined,
      images: school.avatarUrl ? [school.avatarUrl] : [],
      type: 'website',
    },
  };
}

export default async function PublicSchoolPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('PublicSchool');

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-3">
        {school.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={school.avatarUrl}
            alt={school.name}
            className="h-16 w-16 rounded-xl object-cover"
          />
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-(--ssz-text-primary)">{school.name}</h1>
          {school.type && (
            <span className="text-sm font-medium text-(--ssz-primary)">
              {school.type === 'ONLINE' ? t('typeOnline') : t('typeHybrid')}
            </span>
          )}
        </div>

        {school.description && (
          <p className="text-sm leading-relaxed text-(--ssz-text-secondary)">
            {school.description}
          </p>
        )}
      </header>

      {/* Details */}
      <section className="flex flex-col gap-2 text-sm text-(--ssz-text-muted)">
        {school.city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{school.city}</span>
          </div>
        )}
        {school.website && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0" />
            <a
              href={school.website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-(--ssz-text-primary)"
            >
              {school.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        {school.contactEmail && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" />
            <a
              href={`mailto:${school.contactEmail}`}
              className="underline hover:text-(--ssz-text-primary)"
            >
              {school.contactEmail}
            </a>
          </div>
        )}
      </section>

      {/* Apply CTA — rendered separately in Step 5.2 */}
      <div id="apply-cta-slot" />
    </main>
  );
}
