'use client';

import { useTranslations } from 'next-intl';

interface SetProgressProps {
  idx: number;
  total: number;
  accent: string;
}

/** Pill stepper showing position in the exercise set. */
export function SetProgress({ idx, total, accent }: SetProgressProps) {
  const t = useTranslations('ExerciseRunner');

  return (
    <div className="mb-[26px] flex items-center gap-[10px]">
      <div className="flex gap-[5px]" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }).map((_, i) => {
          const isCurrent = i === idx;
          const isDone = i < idx;
          return (
            <div
              key={i}
              style={{
                height: 6,
                width: isCurrent ? 22 : 8,
                borderRadius: 9999,
                background: i <= idx ? accent : 'var(--ssz-border-default)',
                opacity: isDone ? 0.55 : isCurrent ? 1 : 0.4,
                transition: 'all 260ms var(--ssz-ease-out)',
              }}
            />
          );
        })}
      </div>
      <div
        className="text-[12px] font-semibold"
        style={{ color: 'var(--ssz-text-muted)' }}
        aria-hidden="true"
      >
        {t('setProgress', { current: idx + 1, total })}
      </div>
    </div>
  );
}
