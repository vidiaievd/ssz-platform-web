'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Copy, Download, Printer, ShieldCheck, ShieldOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useCurrentUser } from '@/features/auth/api/use-current-user';
import { forgotPasswordAction } from '@/features/auth/actions/forgot-password';

const RESET_COOLDOWN_SECONDS = 45;

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
      <PasswordSection email={currentUser?.email} />
      <TwoFactorSection />
      <SessionsSection />
    </div>
  );
}

function useCopyToClipboard(text: string | undefined) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return { copy, copied };
}

function EmailSection({ email }: { email?: string }) {
  const t = useTranslations('Account.security');
  const { copy, copied } = useCopyToClipboard(email);

  return (
    <section className="space-y-3 max-w-xl">
      <h2 className="text-base font-semibold">{t('email')}</h2>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email ?? ''}
          disabled
          readOnly
          className="text-(--ssz-text-muted)"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void copy()}
          aria-label={t('copyEmail')}
          disabled={!email}
        >
          {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <p className="text-xs text-(--ssz-text-muted)">{t('emailHint')}</p>
    </section>
  );
}

function PasswordSection({ email }: { email?: string }) {
  const t = useTranslations('Account.security');
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function sendReset() {
    if (!email) return;
    startTransition(async () => {
      const result = await forgotPasswordAction({ email });
      if (result.ok) {
        setSent(true);
        setCooldown(RESET_COOLDOWN_SECONDS);
      } else {
        toast.error(t('passwordResetError'));
      }
    });
  }

  const maskedEmail = email
    ? email.replace(/^(.{1,3}).*(@.*)$/, (_, start, end) => `${start}***${end}`)
    : '';

  return (
    <section className="space-y-3 max-w-xl">
      <h2 className="text-base font-semibold">{t('password')}</h2>
      <p className="text-sm text-(--ssz-text-muted)">{t('passwordHint')}</p>
      {sent ? (
        <Alert variant="success">
          {t('passwordResetSentConfirm', { email: email ?? '' })}
          {cooldown > 0 && (
            <span className="block mt-1 text-xs opacity-75">
              {t('passwordResetCooldown', { seconds: cooldown })}
            </span>
          )}
        </Alert>
      ) : null}
      <Button
        variant="outline"
        onClick={sendReset}
        loading={isPending}
        disabled={!email || isPending || cooldown > 0}
      >
        {t('passwordResetCta', { email: maskedEmail })}
      </Button>
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
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const secretKey = state.step === 'setup' ? state.data.secretKey : '';
  const backupCodes = state.step === 'enabled' ? state.backupCodes : [];

  async function copyText(text: string, setCopied: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes(codes: string[]) {
    const content = `SSZ Platform — 2FA backup codes\n\n${codes.join('\n')}\n\nKeep these codes safe. Each can be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ssz-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function printBackupCodes(codes: string[]) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<pre style="font-family:monospace;font-size:14px">SSZ Platform — 2FA backup codes\n\n${codes.join('\n')}\n\nKeep these codes safe. Each can be used once.</pre>`);
    win.print();
    win.close();
  }

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
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{t('twoFa.title')}</h2>
        {state.step === 'enabled' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            <ShieldCheck className="size-3" aria-hidden />
            {t('twoFa.statusOn')}
          </span>
        )}
      </div>
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
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI; next/image does not support data: URLs */}
          <img
            src={`data:image/png;base64,${state.data.qrCodeImageBase64}`}
            alt="2FA QR code"
            className="size-40 rounded"
          />
          <div className="space-y-1">
            <p className="text-xs text-(--ssz-text-muted)">{t('twoFa.secretLabel')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-muted rounded px-2 py-1.5 break-all">
                {secretKey}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void copyText(secretKey, setCopiedKey)}
                aria-label={t('twoFa.copyKey')}
              >
                {copiedKey ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
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
          <Alert
            variant="success"
            icon={<ShieldCheck className="size-4" />}
            title={t('twoFa.backupCodesTitle')}
          >
            <div className="space-y-3 mt-1">
              <p className="text-xs opacity-75">{t('twoFa.backupCodesHint')}</p>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((c) => (
                  <code key={c} className="font-mono text-sm bg-background rounded px-2 py-1">{c}</code>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyText(backupCodes.join('\n'), setCopiedCodes)}
                >
                  {copiedCodes ? <Check className="size-3.5 mr-1.5 text-green-600" /> : <Copy className="size-3.5 mr-1.5" />}
                  {t('twoFa.copyAll')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBackupCodes(backupCodes)}
                >
                  <Download className="size-3.5 mr-1.5" />
                  {t('twoFa.download')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => printBackupCodes(backupCodes)}
                >
                  <Printer className="size-3.5 mr-1.5" />
                  {t('twoFa.print')}
                </Button>
              </div>
            </div>
          </Alert>
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
          <Alert variant="error">
            {t('twoFa.disableConfirm')}
          </Alert>
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
      <div className="rounded-lg border border-border divide-y divide-border animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-muted rounded w-40" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}
