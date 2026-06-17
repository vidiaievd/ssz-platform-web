import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Globe, MapPin } from 'lucide-react';

import { getPublicSchool } from '@/features/school/api/get-public-school';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { ApplyCta, type ApplyCtaState } from '@/features/enrollment/components/apply-cta';
import type { MembershipStatus } from '@/features/enrollment/types';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string }>;
};

type BackendMembership = {
  id: string;
  status: MembershipStatus;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params;
  const school = await getPublicSchool(schoolSlug);
  if (!school) return {};

  return {
    title: school.schoolName,
    description: school.description ?? undefined,
    openGraph: {
      title: school.schoolName,
      description: school.description ?? undefined,
      images: school.avatarUrl ? [school.avatarUrl] : [],
      type: 'website',
    },
  };
}

function membershipStatusToCtaState(status: MembershipStatus): ApplyCtaState {
  if (status === 'active') return 'active';
  if (status === 'onboarding' || status === 'placement-review') return 'onboarding';
  if (status === 'rejected' || status === 'left') return 'rejected';
  return 'pending';
}

export default async function PublicSchoolPage({ params }: Props) {
  const { locale, schoolSlug } = await params;
  const t = await getTranslations('PublicSchool');

  const [school, user] = await Promise.all([
    getPublicSchool(schoolSlug),
    getCurrentUser(),
  ]);
  if (!school) notFound();

  let ctaState: ApplyCtaState = school.isOpenForApplications ? 'guest' : 'invite-only';
  let ctaMembershipId: string | undefined;

  if (user && school.isOpenForApplications) {
    try {
      const membership = await serverFetch<BackendMembership>({
        service: 'organization',
        path: `/schools/${school.schoolId}/memberships/me`,
      });
      ctaState = membershipStatusToCtaState(membership.status);
      ctaMembershipId = membership.id;
    } catch (e) {
      ctaState = e instanceof AppError && e.code !== 'not_found' ? 'guest' : 'apply';
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-3">
        {school.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={school.avatarUrl}
            alt={school.schoolName}
            className="h-16 w-16 rounded-xl object-cover"
          />
        )}
        <h1 className="text-2xl font-bold text-(--ssz-text-primary)">{school.schoolName}</h1>

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
      </section>

      {/* Apply CTA */}
      <section>
        <ApplyCta
          state={ctaState}
          schoolSlug={schoolSlug}
          membershipId={ctaMembershipId}
          locale={locale}
        />
      </section>
    </main>
  );
}
