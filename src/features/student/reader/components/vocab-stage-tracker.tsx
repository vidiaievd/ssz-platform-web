'use client';

import { Check, ListChecks, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type VocabStage = 'triage' | 'learn' | 'done';

const STAGES = [
  { id: 'triage', icon: ListChecks, labelKey: 'triage' },
  { id: 'learn', icon: Sparkles, labelKey: 'learn' },
] as const;

export interface VocabStageTrackerProps {
  stage: VocabStage;
}

/** Mirrors the listening tracker: stays on the last step once the flow is done. */
export function VocabStageTracker({ stage }: VocabStageTrackerProps) {
  const t = useTranslations('Learning.reader.vocab.flow.stages');
  const activeIndex = STAGES.findIndex((s) => s.id === (stage === 'done' ? 'learn' : stage));

  return (
    <div className="mb-6 flex items-center" role="list" aria-label={t('label')}>
      {STAGES.map((s, i) => {
        const done = i < activeIndex || stage === 'done';
        const active = i === activeIndex && stage !== 'done';
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex flex-1 items-center last:flex-none" role="listitem">
            {i > 0 && (
              <div
                aria-hidden="true"
                className="mx-2 h-0.5 flex-1"
                style={{
                  background: done || active ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)',
                  transitionDuration: 'var(--ssz-duration-slow)',
                }}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className="flex h-7.5 w-7.5 items-center justify-center rounded-full border-2"
                style={{
                  background: done
                    ? 'var(--ssz-color-primary-500)'
                    : active
                      ? 'var(--ssz-bg-surface)'
                      : 'var(--ssz-bg-subtle)',
                  borderColor: done || active ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-strong)',
                  boxShadow: active ? '0 0 0 4px var(--ssz-bg-accent)' : 'none',
                  transitionDuration: 'var(--ssz-duration-normal)',
                }}
              >
                {done ? (
                  <Check size={13} color="#fff" aria-hidden="true" />
                ) : (
                  <Icon
                    size={14}
                    style={{ color: active ? 'var(--ssz-text-accent)' : 'var(--ssz-text-muted)' }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className="text-xs font-semibold"
                style={{
                  color: done || active ? 'var(--ssz-text-primary)' : 'var(--ssz-text-muted)',
                }}
              >
                {t(s.labelKey)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
