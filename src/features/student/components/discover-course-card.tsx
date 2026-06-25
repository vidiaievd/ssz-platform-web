'use client';

import { useTranslations } from 'next-intl';
import { Globe, GraduationCap, Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';
import { matchAlsoTaughtAt } from '../lib/course-school-match';

interface DiscoverCourseCardProps {
  container: Container;
  href: string;
  onAskToBePlaced: (match: { schoolId: string; schoolName: string }) => void;
}

/**
 * Catalogue card for `/student/courses` — like `ContainerCard`, but courses
 * also taught by a school get a second action ("Ask to be placed") next to
 * the self-study one, per the Discover dedup rule.
 */
export function DiscoverCourseCard({ container, href, onAskToBePlaced }: DiscoverCourseCardProps) {
  const t = useTranslations('Content');
  const match = matchAlsoTaughtAt(container);

  return (
    <Card noPadding className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-snug">{container.title}</CardTitle>
        {container.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{container.description}</p>
        )}
      </CardHeader>

      <CardBody className="flex-1 py-2">
        <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          {container.targetLanguage && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {container.targetLanguage.toUpperCase()}
            </span>
          )}
          {container.difficultyLevel && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              {container.difficultyLevel}
            </span>
          )}
        </div>

        {match && (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-(--ssz-bg-muted) px-2.5 py-1.5 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('alsoTaughtAt', { school: match.schoolName })}
          </div>
        )}
      </CardBody>

      <CardFooter className="gap-2">
        {match ? (
          <>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href={href}>{t('startSelfStudy')}</Link>
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => onAskToBePlaced(match)}>
              {t('askToBePlaced')}
            </Button>
          </>
        ) : (
          <Button asChild size="sm" className="w-full">
            <Link href={href}>{t('startSelfStudy')}</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
