'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/i18n/navigation';
import { useNavHistoryStore } from '@/stores/nav-history-store';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

/**
 * Back button shown on every account settings tab. Returns the user to the
 * page they were on before entering the account section (tracked globally by
 * NavigationHistoryTracker), falling back to the home page on direct loads.
 */
export function AccountBackButton() {
  const t = useTranslations('Account');
  const router = useRouter();
  const returnPath = useNavHistoryStore((s) => s.returnPath);
  const unsavedChanges = useUnsavedChanges();

  function goBack() {
    const navigate = () => {
      if (returnPath) {
        router.push(returnPath as Parameters<typeof router.push>[0]);
      } else {
        router.push('/');
      }
    };
    if (unsavedChanges) {
      unsavedChanges.guard(navigate);
    } else {
      navigate();
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={goBack}
      className="gap-2 text-(--ssz-text-muted)"
    >
      <ArrowLeft className="size-4" />
      {t('back')}
    </Button>
  );
}
