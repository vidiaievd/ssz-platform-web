'use client';

import { useTranslations } from 'next-intl';

export function PlacementLoading() {
  const t = useTranslations('Placement');

  return (
    <div
      aria-busy="true"
      aria-label={t('loading.ariaLabel')}
      className="flex w-full flex-col gap-[14px] animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
      style={{ maxWidth: 480 }}
    >
      {/* Eyebrow pill */}
      <div
        className="rounded-full"
        style={{ height: 14, width: 120, background: 'var(--ssz-bg-muted)' }}
      />

      {/* Progress dots bar */}
      <div
        className="rounded-full"
        style={{ height: 8, width: '100%', background: 'var(--ssz-bg-muted)' }}
      />

      {/* Title bar */}
      <div
        className="rounded-lg"
        style={{ height: 28, width: '85%', background: 'var(--ssz-bg-muted)' }}
      />

      {/* Subtitle bar */}
      <div
        className="rounded-lg"
        style={{ height: 18, width: '55%', background: 'var(--ssz-bg-muted)' }}
      />

      {/* Option bars — descending opacity */}
      {[1, 0.84, 0.68, 0.52].map((opacity, i) => (
        <div
          key={i}
          className="rounded-xl"
          style={{
            height: 52,
            width: '100%',
            background: 'var(--ssz-bg-muted)',
            opacity,
          }}
        />
      ))}
    </div>
  );
}
