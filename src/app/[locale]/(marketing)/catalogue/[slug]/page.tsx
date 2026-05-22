import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Globe, GraduationCap, BookOpen, LogIn } from 'lucide-react';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import { AppError } from '@/lib/errors';
import type { BadgeProps } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { ContainerTabsClient } from '@/features/content/components/container-tabs';
import type { Container } from '@/features/content/types';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function CatalogueContainerPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('Content');

  let container: Container;
  try {
    container = await serverFetch<Container>({
      service: 'content',
      path: `/api/v1/containers/slug/${slug}`,
      anonymous: false,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    // unauthenticated or unavailable — show sign-in prompt
    return (
      <section className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <LogIn className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
        <h1 className="text-xl font-semibold">{t('signInToView')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('signInToViewDescription')}</p>
        <Button asChild className="mt-6">
          <Link href="/login">{t('signIn')}</Link>
        </Button>
      </section>
    );
  }

  const token = await readAccessToken();
  const isAuthenticated = !!token;

  return (
    <section className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <AccessTierBadgeServer tier={container.accessTier} t={t} />
          {container.type && (
            <Badge variant="muted">{t(`containerType.${container.type}`)}</Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{container.title}</h1>
        {container.description && (
          <p className="text-muted-foreground mt-2">{container.description}</p>
        )}
        <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
          {container.targetLanguage && (
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" />
              {container.targetLanguage.toUpperCase()}
            </span>
          )}
          {container.level && (
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" />
              {container.level}
            </span>
          )}
          {container.lessonCount !== undefined && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {t('lessonCount', { count: container.lessonCount })}
            </span>
          )}
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-muted mb-6 flex items-center justify-between rounded-lg px-4 py-3">
          <p className="text-muted-foreground text-sm">{t('signInToEnrol')}</p>
          <Button asChild size="sm">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
        </div>
      )}

      <ContainerTabsClient
        containerId={container.id}
        versionId={container.publishedVersionId}
      />
    </section>
  );
}

function AccessTierBadgeServer({
  tier,
  t,
}: {
  tier: Container['accessTier'];
  t: Awaited<ReturnType<typeof getTranslations<'Content'>>>;
}) {
  const variants: Record<Container['accessTier'], BadgeProps['variant']> = {
    PUBLIC: 'success',
    FREE_WITHIN_SCHOOL: 'info',
    PAID: 'solid',
    INVITE_ONLY: 'muted',
  };
  return <Badge variant={variants[tier]}>{t(`accessTier.${tier}`)}</Badge>;
}
