'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/api/use-current-user';
import { forgotPasswordAction } from '@/features/auth/actions/forgot-password';

type TwoFaSetupData = {
  secretKey: string;
  qrCodeUri: string;
  qrCodeImageBase64: string;
};

type TwoFaVerifyData = {
  message: string;
  backupCodes: string[];
  warning: string;
};

export function SecurityScreen() {
  const t = useTranslations('Account.security');
  const { data: currentUser } = useCurrentUser();

  return (
    <div className="p-6 md:p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <EmailSection email={currentUser?.email} />
      <ChangeEmailSection />
      <PasswordSection email={currentUser?.email} />
      <TwoFactorSection />
      <SessionsSection />
    </div>
  );
}

function EmailSection({ email }: { email?: string }) {
  const t = useTranslations('Account.security');

  return (
    <section className="space-y-3 max-w-xl">
      <h2 className="text-base font-semibold">{t('email')}</h2>
      <Input
        type="email"
        value={email ?? ''}
        disabled
        readOnly
        className="text-(--ssz-text-muted)"
      />
      <p className="text-xs text-(--ssz-text-muted)">{t('emailHint')}</p>
    </section>
  );
}

function ChangeEmailSection() {
  const t = useTranslations('Account.security');

  return (
    <section className="space-y-3 max-w-xl">
      <h2 className="text-base font-semibold">{t('changeEmail')}</h2>
      <p className="text-sm text-(--ssz-text-muted)">{t('changeEmailHint')}</p>
      <Button variant="outline" disabled>{t('changeEmailCta')}</Button>
    </section>
  );
}

function PasswordSection({ email }: { email?: string }) {
  const t = useTranslations('Account.security');
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function sendReset() {
    if (!email) return;
    startTransition(async () => {
      const result = await forgotPasswordAction({ email });
      if (result.ok) {
        setSent(true);
        toast.success(t('passwordResetSent'));
      } else {
        toast.error(t('passwordResetError'));
      }
    });
  }

  return (
    <section className="space-y-3 max-w-xl">
      <h2 className="text-base font-semibold">{t('password')}</h2>
      <p className="text-sm text-(--ssz-text-muted)">{t('passwordHint')}</p>
      {sent ? (
        <p className="text-sm text-green-600 dark:text-green-400">{t('passwordResetSentConfirm', { email: email ?? '' })}</p>
      ) : (
        <Button
          variant="outline"
          onClick={sendReset}
          loading={isPending}
          disabled={!email || isPending}
        >
          {t('passwordResetCta')}
        </Button>
      )}
    </section>
  );
}

type TwoFaState =
  | { step: 'idle' }
  | { step: 'setup'; data: TwoFaSetupData }
  | { step: 'verify' }
  | { step: 'enabled'; backupCodes: string[] }
  | { step: 'disable' };

function TwoFactorSection() {
  const t = useTranslations('Account.security');
  const [state, setState] = useState<TwoFaState>({ step: 'idle' });
  const [code, setCode] = useState('');
  const [isPending, startTransition] = useTransition();

  function startSetup() {
    startTransition(async () => {
      const res = await fetch('/api/security/2fa/setup', { method: 'POST' });
      if (!res.ok) { toast.error(t('twoFa.setupError')); return; }
      const data = await res.json() as TwoFaSetupData;
      setState({ step: 'setup', data });
    });
  }

  function proceedToVerify() {
    setState({ step: 'verify' });
    setCode('');
  }

  function confirmEnable() {
    if (!code.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/security/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.status === 401) { toast.error(t('twoFa.invalidCode')); return; }
      if (!res.ok) { toast.error(t('twoFa.verifyError')); return; }
      const data = await res.json() as TwoFaVerifyData;
      setState({ step: 'enabled', backupCodes: data.backupCodes });
      setCode('');
      toast.success(t('twoFa.enabled'));
    });
  }

  function startDisable() {
    setState({ step: 'disable' });
    setCode('');
  }

  function confirmDisable() {
    if (!code.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/security/2fa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.status === 401) { toast.error(t('twoFa.invalidCode')); return; }
      if (!res.ok) { toast.error(t('twoFa.disableError')); return; }
      setState({ step: 'idle' });
      setCode('');
      toast.success(t('twoFa.disabled'));
    });
  }

  function cancelFlow() {
    setState({ step: 'idle' });
    setCode('');
  }

  return (
    <section className="space-y-4 max-w-xl">
      <h2 className="text-base font-semibold">{t('twoFa.title')}</h2>
      <p className="text-sm text-(--ssz-text-muted)">{t('twoFa.subtitle')}</p>

      {state.step === 'idle' && (
        <Button variant="outline" onClick={startSetup} loading={isPending}>
          <ShieldCheck className="size-4 mr-2" />
          {t('twoFa.enableCta')}
        </Button>
      )}

      {state.step === 'setup' && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">{t('twoFa.scanQr')}</p>
          <img
            src={`data:image/png;base64,${state.data.qrCodeImageBase64}`}
            alt="2FA QR code"
            className="size-40 rounded"
          />
          <p className="text-xs text-(--ssz-text-muted)">{t('twoFa.secretLabel')}: <code className="font-mono">{state.data.secretKey}</code></p>
          <div className="flex gap-2 pt-2">
            <Button onClick={proceedToVerify} disabled={isPending}>{t('twoFa.nextCta')}</Button>
            <Button variant="ghost" onClick={cancelFlow} disabled={isPending}>{t('cancel')}</Button>
          </div>
        </div>
      )}

      {state.step === 'verify' && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">{t('twoFa.enterCode')}</p>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            disabled={isPending}
            className="max-w-40 font-mono tracking-widest text-center"
          />
          <div className="flex gap-2">
            <Button onClick={confirmEnable} loading={isPending} disabled={code.length !== 6}>{t('twoFa.confirmEnable')}</Button>
            <Button variant="ghost" onClick={cancelFlow} disabled={isPending}>{t('cancel')}</Button>
          </div>
        </div>
      )}

      {state.step === 'enabled' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {t('twoFa.backupCodesTitle')}
            </p>
            <p className="text-xs text-(--ssz-text-muted)">{t('twoFa.backupCodesHint')}</p>
            <div className="grid grid-cols-2 gap-1">
              {state.backupCodes.map((code) => (
                <code key={code} className="font-mono text-sm bg-background rounded px-2 py-1">{code}</code>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={startDisable}
          >
            <ShieldOff className="size-4 mr-2" />
            {t('twoFa.disableCta')}
          </Button>
        </div>
      )}

      {state.step === 'disable' && (
        <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <p className="text-sm font-medium text-destructive">{t('twoFa.disableConfirm')}</p>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            disabled={isPending}
            className="max-w-40 font-mono tracking-widest text-center"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={confirmDisable}
              loading={isPending}
              disabled={code.length !== 6}
            >
              {t('twoFa.confirmDisable')}
            </Button>
            <Button variant="ghost" onClick={cancelFlow} disabled={isPending}>{t('cancel')}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SessionsSection() {
  const t = useTranslations('Account.security');

  return (
    <section className="space-y-3 max-w-xl">
      <h2 className="text-base font-semibold">{t('sessions')}</h2>
      <p className="text-sm text-(--ssz-text-muted)">{t('sessionsHint')}</p>
      <Button variant="outline" disabled>{t('sessionsComingSoon')}</Button>
    </section>
  );
}
