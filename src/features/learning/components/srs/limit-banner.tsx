import { Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function LimitReachedBanner() {
  const t = useTranslations('Srs.limit');

  return (
    <Alert
      icon={<Moon className="h-4 w-4 text-[var(--ssz-color-info-700)]" />}
      title={t('title')}
      className="mb-6"
    >
      <p className="text-sm text-[var(--ssz-text-secondary)]">{t('body')}</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href="/student/enrolled">{t('cta')}</Link>
      </Button>
    </Alert>
  );
}
