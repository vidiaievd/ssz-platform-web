'use client';

import { Check, Headphones, PenLine, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type ListeningStage = 'listen' | 'gapfill' | 'comp' | 'done';

const STAGES = [
  { id: 'listen', icon: Headphones, labelKey: 'listen' },
  { id: 'gapfill', icon: PenLine, labelKey: 'gapfill' },
  { id: 'comp', icon: Target, labelKey: 'comp' },
] as const;

export interface ListeningStageTrackerProps {
  stage: ListeningStage;
}

/** Stays visually on the last stage once the flow reaches `done` (BEHAVIOR.md §7). */
export function ListeningStageTracker({ stage }: ListeningStageTrackerProps) {
  const t = useTranslations('Learning.reader.listening.stages');
  const activeIndex = STAGES.findIndex((s) => s.id === (stage === 'done' ? 'comp' : stage));

  return (
    <div className="mb-7 flex items-center" role="list" aria-label={t('label')}>
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
                  boxShadow: active ? '0 0 0 4px var(--ssz-color-primary-50)' : 'none',
                  transitionDuration: 'var(--ssz-duration-normal)',
                }}
              >
                {done ? (
                  <Check size={13} color="#fff" aria-hidden="true" />
                ) : (
                  <Icon
                    size={14}
                    style={{ color: active ? 'var(--ssz-color-primary-600)' : 'var(--ssz-text-muted)' }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className="text-[12.5px]"
                style={{
                  fontWeight: active || done ? 700 : 500,
                  color: active
                    ? 'var(--ssz-color-primary-700)'
                    : done
                      ? 'var(--ssz-text-secondary)'
                      : 'var(--ssz-text-muted)',
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
