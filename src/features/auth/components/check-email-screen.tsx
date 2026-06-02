'use client';

import { useState, useTransition } from 'react';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { resendVerificationAction } from '../actions/verify-email';

export function CheckEmailScreen() {
  const t = useTranslations('Auth.VerifyEmail');
  const [isPending, startTransition] = useTransition();
  const [resendDone, setResendDone] = useState(false);

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (result.ok) setResendDone(true);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className="flex size-16 items-center justify-center rounded-full"
        style={{ background: 'oklch(var(--ssz-primary-ch) / 0.12)' }}
      >
        <Mail className="size-8" style={{ color: 'oklch(var(--ssz-primary-ch))' }} aria-hidden />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">
          {t('checkTitle')}
        </h1>
        <p className="text-sm text-(--ssz-text-muted) max-w-xs">
          {t('checkBody')}
        </p>
      </div>

      {resendDone ? (
        <p className="text-sm text-(--ssz-text-muted)">{t('resendSuccess')}</p>
      ) : (
        <Button variant="outline" size="sm" onClick={handleResend} loading={isPending}>
          {t('resend')}
        </Button>
      )}

      <Link href="/login" className="text-sm text-(--ssz-text-link) hover:underline">
        {t('signIn')}
      </Link>
    </div>
  );
}
