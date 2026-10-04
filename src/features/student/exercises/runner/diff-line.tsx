'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import type { VerdictOp, WordCounts } from '@/lib/shared-kernel/dictation';

/**
 * The corrected line of a `dictation` check, and the two keys that read it — plan 68 §7.1.
 *
 * One renderer for every context the line appears in (AC-X10): the runner's verdict, the
 * summary (`size="sm"`), the builder's «Try a student answer» and its preview. It draws the
 * ops as they came — from the server for a student, from the kernel's `diff` for a teacher
 * who holds the key — and decides nothing.
 *
 * Every deviation has a shape as well as a colour (AC-R6): an extra word is struck through,
 * a missing one underlined, a wrong one struck through and followed by the right one in
 * bold. Each also carries a `title` and, for a screen reader, one phrase — «wrote X, correct
 * Y» — in place of two runs that would be read as unrelated words (AC-X11).
 */

type T = ReturnType<typeof useTranslations<'ExerciseRunner.dictation'>>;

/** `dc.css`: the line is reading type, set loose enough for the backgrounds to breathe. */
const LINE: Record<'md' | 'sm', CSSProperties> = {
  md: { fontSize: 'var(--ssz-text-lg)', lineHeight: 2.25 },
  sm: { fontSize: 'var(--ssz-text-base)', lineHeight: 2 },
};

const CHIP = {
  extra: {
    background: 'var(--ssz-feedback-no-bg)',
    color: 'var(--ssz-feedback-no-fg)',
    textDecoration: 'line-through',
    textDecorationThickness: '1.5px',
    padding: '2px 4px',
  },
  miss: {
    background: 'var(--ssz-feedback-key-bg)',
    color: 'var(--ssz-feedback-key-fg)',
    boxShadow: 'inset 0 -2px 0 0 var(--ssz-feedback-key-line)',
    padding: '2px 4px',
  },
  near: {
    background: 'var(--ssz-feedback-near-bg)',
    color: 'var(--ssz-feedback-near-fg)',
    padding: '2px 5px',
  },
  wrong: {
    background: 'var(--ssz-feedback-no-bg)',
    color: 'var(--ssz-feedback-no-fg)',
    padding: '2px 5px',
  },
} satisfies Record<string, CSSProperties>;

/** The phrase a screen reader hears for one deviation, or `null` for a word written right. */
export function deviationPhrase(op: VerdictOp, t: T): string | null {
  switch (op.k) {
    case 'eq':
      return null;
    case 'ins':
      return t('sr.extra', { wrote: op.wrote });
    case 'del':
      return t('sr.missing', { expected: op.expected });
    case 'sub':
      return t('sr.sub', { wrote: op.wrote, expected: op.expected });
  }
}

export interface DiffLineProps {
  ops: readonly VerdictOp[];
  size?: 'md' | 'sm';
}

export function DiffLine({ ops, size = 'md' }: DiffLineProps) {
  const t = useTranslations('ExerciseRunner.dictation');

  return (
    <p
      data-size={size}
      className="m-0"
      style={{ ...LINE[size], fontFamily: 'var(--ssz-font-reading)', textWrap: 'pretty' }}
    >
      {ops.map((op, i) => (
        <Op key={i} op={op} t={t} />
      ))}
    </p>
  );
}

function Op({ op, t }: { op: VerdictOp; t: T }) {
  const punct = (p: string): ReactNode =>
    p === '' ? null : <i style={{ fontStyle: 'normal', opacity: 0.6 }}>{p}</i>;

  if (op.k === 'eq') {
    return (
      <>
        <span data-s="eq" style={{ color: 'var(--ssz-text-primary)' }}>
          {op.w}
          {punct(op.p)}
        </span>{' '}
      </>
    );
  }

  const spoken = <span className="sr-only">{deviationPhrase(op, t)}</span>;

  if (op.k === 'ins') {
    return (
      <>
        <span data-s="extra" title={t('title.extra')} className="rounded-[5px]" style={CHIP.extra}>
          <span aria-hidden="true">{op.wrote}</span>
          {spoken}
        </span>{' '}
      </>
    );
  }

  if (op.k === 'del') {
    return (
      <>
        <span data-s="miss" title={t('title.missing')} className="rounded-[5px]" style={CHIP.miss}>
          <span aria-hidden="true">
            {op.expected}
            {punct(op.p)}
          </span>
          {spoken}
        </span>{' '}
      </>
    );
  }

  const state = op.near ? 'near' : 'wrong';
  return (
    <>
      <span
        data-s={state}
        data-focus={op.focus ? 'true' : undefined}
        title={op.focus ? t('title.focus') : t(`cls.${op.cls}`)}
        className="rounded-[5px]"
        style={CHIP[state]}
      >
        <span aria-hidden="true">
          <s
            style={{
              textDecorationThickness: '1.5px',
              opacity: 0.7,
              marginRight: 4,
            }}
          >
            {op.wrote}
          </s>
          <b
            style={{
              fontWeight: 'var(--ssz-weight-semibold)',
              color: 'var(--ssz-feedback-ok-fg)',
            }}
          >
            {op.expected}
            {op.p}
          </b>
        </span>
        {spoken}
      </span>{' '}
    </>
  );
}

// ── the keys ────────────────────────────────────────────────────────────────

type Swatch = 'eq' | 'near' | 'wrong' | 'missing' | 'extra';

const SWATCH: Record<Swatch, CSSProperties> = {
  eq: { background: 'var(--ssz-color-success-500)' },
  near: { background: 'var(--ssz-color-warning-500)' },
  wrong: { background: 'var(--ssz-color-error-500)' },
  missing: {
    background: 'var(--ssz-feedback-key-bg)',
    boxShadow: 'inset 0 -3px 0 0 var(--ssz-feedback-key-line)',
  },
  extra: {
    background: 'var(--ssz-feedback-no-bg)',
    boxShadow: 'inset 0 0 0 1.5px var(--ssz-feedback-no-line)',
  },
};

const SWATCHES: readonly Swatch[] = ['eq', 'near', 'wrong', 'missing', 'extra'];

function Square({ s }: { s: Swatch }) {
  return (
    <i aria-hidden="true" className="block size-2.5 shrink-0 rounded-[3px]" style={SWATCH[s]} />
  );
}

/** How many of each — only the counts that are not zero. */
export function DiffTally({ words }: { words: WordCounts }) {
  const t = useTranslations('ExerciseRunner.dictation');
  const counts: Record<Swatch, number> = {
    eq: words.exact,
    near: words.near,
    wrong: words.wrong,
    missing: words.missing,
    extra: words.extra,
  };

  return (
    <span className="inline-flex flex-wrap gap-(--ssz-space-3) text-xs text-(--ssz-text-secondary)">
      {SWATCHES.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} data-s={s} className="inline-flex items-center gap-[5px]">
          <Square s={s} />
          {t(`tally.${s}`, { n: counts[s] })}
        </span>
      ))}
    </span>
  );
}

/** All five, with the summary — what the colours and shapes mean. */
export function DiffLegend() {
  const t = useTranslations('ExerciseRunner.dictation');
  return (
    <div className="flex flex-wrap gap-(--ssz-space-3) text-[11px] text-(--ssz-text-muted)">
      {SWATCHES.map((s) => (
        <span key={s} className="inline-flex items-center gap-[5px]">
          <Square s={s} />
          {t(`legend.${s}`)}
        </span>
      ))}
    </div>
  );
}

/** A percentage as the server gave it: red until it passed, green once it did. */
export function DiffScore({
  pct,
  ok,
  size = 'md',
}: {
  pct: number;
  ok: boolean;
  size?: 'md' | 'sm' | 'xl';
}) {
  return (
    <b
      data-ok={ok ? 'true' : undefined}
      className="font-bold"
      style={{
        fontSize:
          size === 'xl'
            ? 'var(--ssz-text-3xl)'
            : size === 'sm'
              ? 'var(--ssz-text-sm)'
              : 'var(--ssz-text-lg)',
        fontVariantNumeric: 'tabular-nums',
        color: ok ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-feedback-no-fg)',
      }}
    >
      {pct}%
    </b>
  );
}
