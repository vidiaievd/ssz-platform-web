'use client';

import { useTranslations } from 'next-intl';

/** Skeleton body shown while an exercise item is loading. */
export function RunnerLoadingBody() {
  const t = useTranslations('ExerciseRunner');
  const sk: React.CSSProperties = { background: 'var(--ssz-bg-muted)', borderRadius: 8 };

  return (
    <div
      className="w-full px-6 py-[40px]"
      style={{ maxWidth: 560 }}
      aria-busy="true"
      aria-label={t('loading')}
    >
      {/* Pill stepper placeholder */}
      <div style={{ ...sk, height: 6, width: 120, marginBottom: 30, borderRadius: 9999 }} />
      {/* Eyebrow placeholder */}
      <div style={{ ...sk, height: 12, width: 130, marginBottom: 18 }} />
      {/* Question stem placeholders */}
      <div style={{ ...sk, height: 26, width: '85%', marginBottom: 10 }} />
      <div style={{ ...sk, height: 26, width: '55%', marginBottom: 28 }} />
      {/* Option placeholders */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ ...sk, height: 54, marginBottom: 10, opacity: 1 - i * 0.18 }} />
      ))}

      <style>{`
        @keyframes runner-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.45 } }
        [aria-busy="true"] > div {
          animation: runner-pulse 1.4s var(--ssz-ease-inout, ease-in-out) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-busy="true"] > div { animation: none; }
        }
      `}</style>
    </div>
  );
}
