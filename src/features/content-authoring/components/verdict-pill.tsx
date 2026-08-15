'use client';

import type { ReactNode } from 'react';
import { Check, CircleAlert } from 'lucide-react';

/** How a verdict reads at a glance. Only a pass is ever `ok`. */
export type VerdictTone = 'ok' | 'warn' | 'bad' | 'muted';

/**
 * The verdict pill, shared by every template that can route a submission to a person.
 *
 * The vocabularies differ — translate has `near`, error correction has `partial` and
 * `stray` — but the reading must not: a teacher works one queue, and a pill that changed
 * colour with the template would make them re-learn the palette per exercise. So the tone
 * and the shape live here, and each template supplies only its own wording.
 */
export function VerdictPill({ tone, children }: { tone: VerdictTone; children: ReactNode }) {
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
      {children}
    </span>
  );
}
