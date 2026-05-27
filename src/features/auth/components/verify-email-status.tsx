'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';

import { verifyEmailConfirmAction, resendVerificationAction } from '../actions/verify-email';

// TODO: remove debug mode before merging
const DEBUG = true;

function resolvePostVerifyPath(roles: string[]): string {
  if (roles.includes('school_admin')) return '/onboarding/school';
  if (roles.includes('tutor')) return '/onboarding?step=profile';
  return '/onboarding?step=profile';
}

type VerifyEmailStatusProps = {
  token: string;
};

type ActionResult =
  | { ok: true; value: { roles: string[] } }
  | { ok: false; error: { code: string; message: string } };

export function VerifyEmailStatus({ token }: VerifyEmailStatusProps) {
  const t = useTranslations('Auth.VerifyEmail');
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resendDone, setResendDone] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    verifyEmailConfirmAction(token).then((result) => {
      setDebugResult(result as ActionResult);
      if (!result.ok) {
        setStatus('error');
        setErrorCode(result.error.code);
        return;
      }
      setStatus('success');
      if (!DEBUG) {
        router.replace(resolvePostVerifyPath(result.value.roles));
      }
    });
  }, [token, router]);

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (result.ok) setResendDone(true);
    });
  }

  function handleContinue() {
    if (debugResult?.ok) {
      router.replace(resolvePostVerifyPath(debugResult.value.roles));
    }
  }

  const debugPanel = DEBUG && (
    <div className="mt-6 w-full rounded-md border border-yellow-400 bg-yellow-50 p-4 text-left dark:bg-yellow-950/30">
      <p className="mb-2 text-xs font-bold text-yellow-700 dark:text-yellow-400">
        🐛 DEBUG — убрать перед мержем
      </p>
      <p className="mb-1 text-xs text-yellow-800 dark:text-yellow-300">
        <span className="font-semibold">token:</span>{' '}
        <span className="break-all font-mono">{token}</span>
      </p>
      <p className="mb-1 text-xs text-yellow-800 dark:text-yellow-300">
        <span className="font-semibold">status:</span> {status}
      </p>
      <pre className="mt-2 overflow-x-auto rounded bg-yellow-100 p-2 text-xs text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200">
        {JSON.stringify(debugResult, null, 2)}
      </pre>
      {debugResult?.ok && (
        <Button size="sm" className="mt-3" onClick={handleContinue}>
          → Продолжить ({resolvePostVerifyPath(debugResult.value.roles)})
        </Button>
      )}
    </div>
  );

  if (status === 'verifying') {
    return (
      <div>
        <p className="text-center text-sm text-(--ssz-text-muted)">{t('verifying')}</p>
        {debugPanel}
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-(--ssz-text-primary)">{t('successTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('successDescription')}</p>
        {debugPanel}
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
      {debugPanel}
    </div>
  );
}
