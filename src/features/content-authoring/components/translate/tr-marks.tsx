'use client';

import { useTranslations } from 'next-intl';
import { Check, CircleAlert, User } from 'lucide-react';

import type { DiffToken, Routing, Verdict } from '@/lib/shared-kernel/translate';

const READING = 'var(--ssz-font-reading)';

/** How each verdict reads. Only `exact` is ever a pass — everything else is for a human. */
const VERDICT_TONE: Record<Verdict, 'ok' | 'warn' | 'bad' | 'muted'> = {
  exact: 'ok',
  typo: 'warn',
  near: 'warn',
  off: 'bad',
  empty: 'muted',
  noref: 'muted',
};

/**
 * The verdict, the routing and the diff, in the three places an author meets them: the
 * tester, the routing table of step 3 and the queue preview of step 4.
 *
 * They are one component set rather than three renderings because they are one claim. An
 * author reads the routing table to learn what `near` does, tries an answer that lands
 * there, and then finds the same submission in the queue preview — if the three drew the
 * verdict differently, the tester would be teaching a vocabulary the queue does not speak.
 */
export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const t = useTranslations('Authoring');
  const tone = VERDICT_TONE[verdict];

  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === 'ok'
          ? 'bg-success-50 text-success-700'
          : tone === 'warn'
            ? 'bg-warning-100 text-warning-700'
            : tone === 'bad'
              ? 'bg-error/10 text-error'
              : 'bg-[var(--ssz-bg-subtle)] text-muted-foreground'
      }`}
    >
      {tone === 'ok' ? (
        <Check className="size-3" aria-hidden />
      ) : (
        <CircleAlert className="size-3" aria-hidden />
      )}
      {t(`translate.verdict.${verdict}` as 'translate.verdict.exact')}
    </span>
  );
}

/** Where the answer goes. `pass` is reachable from a hit on the key and nowhere else. */
export function RouteChip({ routing }: { routing: Routing }) {
  const t = useTranslations('Authoring');

  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
        routing === 'pass'
          ? 'border-success-500/50 text-success-700'
          : 'border-border text-[var(--ssz-text-secondary)]'
      }`}
    >
      {routing === 'pass' ? (
        <Check className="size-3" aria-hidden />
      ) : (
        <User className="size-3" aria-hidden />
      )}
      {routing === 'pass' ? t('translate.tester.routePass') : t('translate.tester.routeTeacher')}
    </span>
  );
}

/**
 * An answer against the closest accepted translation, word by word.
 *
 * Nothing is masked: everyone who sees this component has the answer key open on the same
 * screen. The student's own diff is masked on the server and rendered by the runner, which
 * is a different component for exactly that reason.
 */
export function DiffLine({ tokens }: { tokens: DiffToken[] }) {
  const t = useTranslations('Authoring');

  return (
    <p
      className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-2 text-sm"
      style={{ fontFamily: READING }}
      aria-label={t('translate.tester.diffLabel')}
    >
      {tokens.map((token, position) => (
        <span
          key={position}
          className={
            token.t === 'extra'
              ? 'rounded bg-error/10 px-1 text-error line-through'
              : token.t === 'missing'
                ? 'rounded bg-success-50 px-1 text-success-700'
                : token.typo !== null
                  ? 'rounded bg-warning-100 px-1 text-warning-700'
                  : undefined
          }
        >
          {token.typo ?? token.w}
        </span>
      ))}
    </p>
  );
}

/** Colour is never the only signal in the diff: this says what each one means. */
export function DiffLegend() {
  const t = useTranslations('Authoring');

  return (
    <ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <li>{t('translate.tester.legendExtra')}</li>
      <li>{t('translate.tester.legendMissing')}</li>
      <li>{t('translate.tester.legendTypo')}</li>
    </ul>
  );
}
