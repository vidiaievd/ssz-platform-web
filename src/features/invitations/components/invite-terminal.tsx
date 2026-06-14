'use client';

import { AlertTriangle, Ban, CheckCircle, XCircle, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';

export type TerminalState = 'invalid' | 'expired' | 'revoked' | 'accepted' | 'error';

type Props = {
  state: TerminalState;
  workspacePath?: string;
  onRetry?: () => void;
};

const ICONS: Record<TerminalState, React.ElementType> = {
  invalid: XCircle,
  expired: AlertTriangle,
  revoked: Ban,
  accepted: CheckCircle,
  error: WifiOff,
};

const ICON_CLASSES: Record<TerminalState, string> = {
  invalid: 'text-error',
  expired: 'text-warning',
  revoked: 'text-error',
  accepted: 'text-success',
  error: 'text-(--ssz-text-muted)',
};

export function InviteTerminal({ state, workspacePath, onRetry }: Props) {
  const t = useTranslations('Invite');
  const Icon = ICONS[state];

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Icon
        className={`size-12 ${ICON_CLASSES[state]}`}
        aria-hidden
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)" tabIndex={-1}>
          {t(`state.${state}.title`)}
        </h1>
        <p className="text-sm text-(--ssz-text-secondary)">
          {t(`state.${state}.body`)}
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {state === 'error' && onRetry && (
          <Button onClick={onRetry} className="w-full">
            {t('cta.retry')}
          </Button>
        )}
        {state === 'accepted' && workspacePath && (
          <Button asChild className="w-full">
            <Link href={workspacePath}>{t('cta.goToWorkspace')}</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/">{t('cta.goHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
