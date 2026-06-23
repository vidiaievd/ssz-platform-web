import { useTranslations } from 'next-intl';
import { BookOpen, Globe, GraduationCap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import type { BadgeProps } from '@/components/ui/badge';
import type { Container } from '../types';

interface ContainerCardProps {
  container: Container;
  href: string;
}

export function ContainerCard({ container, href }: ContainerCardProps) {
  const t = useTranslations('Content');

  return (
    <Card noPadding className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{container.title}</CardTitle>
          <AccessTierBadge tier={container.accessTier} />
        </div>
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
          {container.lessonCount !== undefined && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {t('lessonCount', { count: container.lessonCount })}
            </span>
          )}
        </div>
      </CardBody>

      <CardFooter>
        <Button asChild size="sm" className="w-full">
          <Link href={href}>{t('openContainer')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function AccessTierBadge({ tier }: { tier: Container['accessTier'] }) {
  const t = useTranslations('Content');
  const variants: Record<Container['accessTier'], BadgeProps['variant']> = {
    public_free: 'success',
    free_within_school: 'info',
    public_paid: 'solid',
    assigned_only: 'muted',
    entitlement_required: 'muted',
  };
  return <Badge variant={variants[tier]}>{t(`accessTier.${tier}`)}</Badge>;
}
