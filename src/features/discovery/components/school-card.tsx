import { useTranslations } from 'next-intl';
import { BookOpen, Globe, GraduationCap, MapPin, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { BadgeProps } from '@/components/ui/badge';
import type { School, SchoolType } from '../types';

interface SchoolCardProps {
  school: School;
  onEnrol?: (school: School) => void;
}

const TYPE_BADGE_VARIANTS: Record<SchoolType, BadgeProps['variant']> = {
  school: 'info',
  tutor: 'muted',
};

export function SchoolCard({ school, onEnrol }: SchoolCardProps) {
  const t = useTranslations('Discovery');

  const levelRange =
    school.levels.length > 1
      ? `${school.levels[0]}–${school.levels[school.levels.length - 1]}`
      : (school.levels[0] ?? '');

  return (
    <Card noPadding className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{school.name}</CardTitle>
          <Badge variant={TYPE_BADGE_VARIANTS[school.type]}>
            {t(`schoolType.${school.type}`)}
          </Badge>
        </div>
        {school.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{school.description}</p>
        )}
      </CardHeader>

      <CardBody className="flex-1 py-2">
        <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          {school.targetLanguages.length > 0 && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" aria-hidden="true" />
              {school.targetLanguages.map((l) => l.toUpperCase()).join(', ')}
            </span>
          )}
          {levelRange && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" aria-hidden="true" />
              {levelRange}
            </span>
          )}
          {school.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {school.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            {t('containerCount', { count: school.containerCount })}
          </span>
          {school.studentCount !== undefined && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {t('studentCount', { count: school.studentCount })}
            </span>
          )}
        </div>

        <div className="mt-3">
          {school.isFree ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              {t('free')}
            </span>
          ) : school.priceRangeMin !== undefined ? (
            <span className="text-muted-foreground text-xs">
              {t('fromPrice', {
                price: school.priceRangeMin,
                currency: school.currency ?? 'NOK',
              })}
            </span>
          ) : null}
        </div>
      </CardBody>

      <CardFooter>
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => onEnrol?.(school)}
        >
          {t('requestEnrol')}
        </Button>
      </CardFooter>
    </Card>
  );
}
