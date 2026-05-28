'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';

import { verifyEmailConfirmAction, resendVerificationAction } from '../actions/verify-email';

function resolvePostVerifyPath(roles: string[]): string {
  if (roles.includes('school_admin')) return '/onboarding/school';
  if (roles.includes('tutor')) return '/onboarding?step=profile';
  return '/onboarding?step=profile';
}

type VerifyEmailStatusProps = {
  token: string;
};

export function VerifyEmailStatus({ token }: VerifyEmailStatusProps) {
  const t = useTranslations('Auth.VerifyEmail');
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resendDone, setResendDone] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    verifyEmailConfirmAction(token).then((result) => {
      if (!result.ok) {
        setStatus('error');
        setErrorCode(result.error.code);
        return;
      }
      setStatus('success');
      router.replace(resolvePostVerifyPath(result.value.roles));
    });
  }, [token, router]);

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (result.ok) setResendDone(true);
    });
  }

  if (status === 'verifying') {
    return (
      <div>
        <p className="text-center text-sm text-(--ssz-text-muted)">{t('verifying')}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-(--ssz-text-primary)">{t('successTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('successDescription')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="font-semibold text-error">{t('errorTitle')}</p>
      <p className="text-sm text-(--ssz-text-muted)">
        {errorCode === 'not_found' ? t('errorExpired') : t('errorDescription')}
      </p>
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
