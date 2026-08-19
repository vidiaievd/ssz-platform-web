'use client';

import { useTranslations } from 'next-intl';
import { Check, User } from 'lucide-react';

import type { DiffToken as DiffTokenShape, Routing, Verdict } from '@/lib/shared-kernel/translate';

import { VerdictPill, type VerdictTone } from '../verdict-pill';

const READING = 'var(--ssz-font-reading)';

/** How each verdict reads. Only `exact` is ever a pass — everything else is for a human. */
const VERDICT_TONE: Record<Verdict, VerdictTone> = {
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

  return (
    <VerdictPill tone={VERDICT_TONE[verdict]}>
      {t(`translate.verdict.${verdict}` as 'translate.verdict.exact')}
    </VerdictPill>
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
export function DiffLine({ tokens }: { tokens: DiffTokenShape[] }) {
  const t = useTranslations('Authoring');

  return (
    // A group rather than a labelled paragraph: `aria-label` on a text container replaces
    // everything inside it, which would have silenced the per-word marks below.
    <p
      role="group"
      aria-label={t('translate.tester.diffLabel')}
      className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-2 text-sm"
      style={{ fontFamily: READING }}
    >
      {tokens.map((token, position) => (
        <DiffToken key={position} token={token} />
      ))}
    </p>
  );
}

/**
 * One word of the diff, marked twice over.
 *
 * Colour alone would say nothing to a reader who cannot see it, and nothing at all in
 * print: a word the key has and the answer misses is therefore also **bold**, a word the
 * answer has and the key does not is struck through, and a near-miss is italic. The name
 * of the mark travels with it for screen readers, since "bold" is not a meaning.
 */
function DiffToken({ token }: { token: DiffTokenShape }) {
  const t = useTranslations('Authoring');

  if (token.t === 'extra') {
    return (
      <span className="rounded bg-error/10 px-1 text-error line-through">
        <span className="sr-only">{t('translate.tester.legendExtra')}: </span>
        {token.typo ?? token.w}
      </span>
    );
  }

  if (token.t === 'missing') {
    return (
      <span className="rounded bg-success-50 px-1 font-bold text-success-700">
        <span className="sr-only">{t('translate.tester.legendMissing')}: </span>
        {token.typo ?? token.w}
      </span>
    );
  }

  if (token.typo !== null && token.typo !== undefined) {
    return (
      <span className="rounded bg-warning-100 px-1 italic text-warning-700">
        <span className="sr-only">{t('translate.tester.legendTypo')}: </span>
        {token.typo}
      </span>
    );
  }

  return <span>{token.w}</span>;
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
