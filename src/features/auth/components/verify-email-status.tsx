'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';

import { verifyEmailConfirmAction, resendVerificationAction } from '../actions/verify-email';
import { resolvePostLoginPath } from '../utils/resolve-post-login-path';
import { POST_VERIFY_NEXT_KEY } from './check-email-screen';
import { track } from '@/lib/analytics/track';

type VerifyEmailStatusProps = {
  token: string;
  /** Post-verification redirect (e.g. /invite/{inviteToken}). */
  next?: string;
};

export function VerifyEmailStatus({ token, next }: VerifyEmailStatusProps) {
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
    track({ name: 'verify_opened' });

    verifyEmailConfirmAction(token).then((result) => {
      if (!result.ok) {
        track({ name: 'verify_failed', code: result.error.code });
        setStatus('error');
        setErrorCode(result.error.code);
        return;
      }
      track({ name: 'verify_succeeded' });
      setStatus('success');
      // Priority: auto-accepted invite redirect (server-side, cross-browser safe)
      // → explicit next prop → localStorage fallback → workspace resolver.
      const destination =
        result.value.acceptedInviteRedirect ??
        next ??
        localStorage.getItem(POST_VERIFY_NEXT_KEY) ??
        resolvePostLoginPath({ roles: result.value.roles, hasStudentProfile: false, hasTutorProfile: false });
      localStorage.removeItem(POST_VERIFY_NEXT_KEY);
      router.replace(destination);
    });
  }, [token, router]);

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (result.ok) {
        track({ name: 'verify_resent' });
        setResendDone(true);
      }
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
