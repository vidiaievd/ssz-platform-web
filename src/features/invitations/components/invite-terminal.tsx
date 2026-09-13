'use client';

import { AlertTriangle, Ban, CheckCircle, XCircle, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';

export type TerminalState = 'invalid' | 'expired' | 'revoked' | 'accepted' | 'error';

export type TerminalVariant = 'school' | 'tutoring';

type Props = {
  state: TerminalState;
  /** A tutoring invitation must never mention a school. Defaults to 'school'. */
  variant?: TerminalVariant;
  workspacePath?: string;
  onRetry?: () => void;
};

/** Only these two bodies name the sender; the rest read the same either way. */

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

export function InviteTerminal({ state, variant = 'school', workspacePath, onRetry }: Props) {
  const t = useTranslations('Invite');
  const Icon = ICONS[state];
  const body =
    variant === 'tutoring' && state === 'expired'
      ? t('state.expired.bodyTutoring')
      : variant === 'tutoring' && state === 'revoked'
        ? t('state.revoked.bodyTutoring')
        : t(`state.${state}.body`);

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
          {body}
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
