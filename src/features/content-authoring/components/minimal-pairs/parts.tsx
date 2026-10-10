'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  AudioWaveform,
  Bot,
  Headphones,
  Mic,
  Sparkles,
  Split,
  Target,
  Type,
  type LucideIcon,
} from 'lucide-react';

import type { ContrastIcon, Provenance, TtsPolicy } from '@/lib/shared-kernel/minimal-pairs';

/**
 * The pieces the `minimal_pairs` steps share — the `mp-*` and `wb-*` classes of the handoff
 * (`mp/mp.css`), carried as token values around the project's own controls (plan 72 §7).
 */

export const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
export const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;

/** The prototype's icon names of the pack families → lucide (§7). */
export const FAMILY_ICONS: Record<ContrastIcon, LucideIcon> = {
  target: Target,
  text: Type,
  sparkle: Sparkles,
  wave: AudioWaveform,
  split: Split,
};

export const DELETE = 'hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)';

/** `A`, `B`, `C` — a word's place in its pair. */
export function sideOf(index: number): string {
  return String.fromCharCode(65 + index);
}

/** `mp-side`: the round letter at the start of a word row. */
export function Side({ index }: { index: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-[22px] shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
    >
      {sideOf(index)}
    </span>
  );
}

const TTS_TONE: Record<TtsPolicy, string> = {
  ok: 'bg-(--ssz-color-success-50) text-(--ssz-color-success-700)',
  risky: 'bg-(--ssz-color-warning-50) text-(--ssz-color-warning-700)',
  no: 'bg-(--ssz-color-error-50) text-(--ssz-color-error-700)',
};

/** `mp-tts`: the synthesis policy of a family, as a small capitals chip. */
export function TtsChip({ tts, children }: { tts: TtsPolicy; children?: ReactNode }) {
  const t = useTranslations('Authoring.minimalPairs.tts');
  return (
    <span
      data-t={tts}
      className={`inline-block rounded-full px-[7px] py-0.5 text-[10px] tracking-wide uppercase ${TTS_TONE[tts]}`}
    >
      {children ?? t(tts)}
    </span>
  );
}

const PROV: Record<Provenance, { icon: LucideIcon; tone: string }> = {
  studio: {
    icon: Headphones,
    tone: 'bg-(--ssz-color-success-50) text-(--ssz-color-success-700)',
  },
  teacher: { icon: Mic, tone: 'bg-(--ssz-bg-muted) text-(--ssz-text-secondary)' },
  tts: { icon: Bot, tone: 'bg-(--ssz-color-warning-50) text-(--ssz-color-warning-700)' },
};

const PILL =
  'inline-flex items-center gap-1 rounded-full px-[7px] py-0.5 text-[10px] tracking-wide whitespace-nowrap';

/** `MPProv`: who said it. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const t = useTranslations('Authoring.minimalPairs.prov');
  const { icon: Icon, tone } = PROV[provenance];
  return (
    <span data-p={provenance} className={`${PILL} ${tone}`}>
      <Icon size={11} aria-hidden="true" />
      {t(provenance)}
    </span>
  );
}

/** `mp-prov[data-p=none]`: the library's «uten lyd». */
export function NoAudioBadge({ children }: { children: ReactNode }) {
  return (
    <span
      data-p="none"
      className={`${PILL} border border-dashed border-(--ssz-border-strong) text-(--ssz-text-muted)`}
    >
      {children}
    </span>
  );
}

/** `MPBar`: the clip's length against the longest of the step. Amber when the pair's spread warns. */
export function DurationBar({ ms, max, warn }: { ms: number; max: number; warn: boolean }) {
  const width = Math.max(4, Math.min(100, (ms / max) * 100));
  return (
    <span
      aria-hidden="true"
      data-tone={warn ? 'warn' : undefined}
      className="block h-1.5 max-w-[220px] min-w-[60px] flex-1 overflow-hidden rounded-full bg-(--ssz-bg-muted)"
    >
      <i
        className="block h-full rounded-[inherit]"
        style={{
          width: `${width}%`,
          background: warn ? 'var(--ssz-color-warning-500)' : 'var(--ssz-color-primary-400)',
        }}
      />
    </span>
  );
}

/**
 * A pair's card — `wb-card` with its head: the number, what the pair says, then whatever the
 * step puts on the right. `bad` draws the red edge (`data-bad`).
 */
export function PairCard({
  index,
  title,
  bad,
  head,
  children,
}: {
  index: number;
  title: string;
  bad: boolean;
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-bad={bad ? 'true' : undefined}
      className={`rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) ${
        bad ? 'border-(--ssz-color-error-500)' : 'border-(--ssz-border-default)'
      }`}
      style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
    >
      <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-2 pl-3">
        <span
          aria-hidden="true"
          className="grid size-[22px] shrink-0 place-items-center rounded-(--ssz-radius-sm) bg-(--ssz-bg-subtle) text-[11px] font-bold text-(--ssz-text-secondary)"
          style={MONO}
        >
          {index + 1}
        </span>
        <strong className="min-w-0 truncate text-sm">{title}</strong>
        {head}
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

/** `wb-sec-head`: an eyebrow and a heading on the left, actions on the right. */
export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="m-0 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-600) uppercase">
          {eyebrow}
        </p>
        <h3 className="m-0 mt-1 text-lg font-bold tracking-tight">{title}</h3>
      </div>
      {children !== undefined && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
