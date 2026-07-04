'use client';

import { Target, Zap, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ── design tokens ──────────────────────────────────────────────────────────── */
const PRIMARY     = 'var(--ssz-color-primary-500)';
const PRIMARY_700 = 'var(--ssz-color-primary-700)';
const PRIMARY_BG  = 'var(--ssz-color-primary-50)';
const PRIMARY_BD  = 'var(--ssz-color-primary-100)';

/* ── icon tile ───────────────────────────────────────────────────────────────── */
function PlacementIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: PRIMARY_BG,
        border: `1.5px solid ${PRIMARY_BD}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Target size={28} style={{ color: PRIMARY_700 }} strokeWidth={1.5} />
    </div>
  );
}

/* ── feature rows ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Zap,          titleKey: 'time'  as const },
  { icon: RefreshCw,    titleKey: 'adapt' as const },
  { icon: CheckCircle2, titleKey: 'skip'  as const },
] as const;

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementIntroProps {
  /** true in the inline card presentation (compact layout, left-aligned) */
  compact?: boolean;
  onTakePlacement: () => void;
  onSkipToBeginning: () => void;
}

export function PlacementIntro({
  compact = false,
  onTakePlacement,
  onSkipToBeginning,
}: PlacementIntroProps) {
  const t = useTranslations('Placement.intro');

  return (
    <div
      className={compact ? 'flex flex-col gap-[16px]' : 'flex flex-col items-center gap-[20px] text-center'}
      style={{ maxWidth: compact ? undefined : 440 }}
    >
      <PlacementIcon />

      <div className={compact ? undefined : 'flex flex-col items-center gap-[8px]'}>
        <h1
          className="font-bold leading-[1.2]"
          style={{
            fontSize: compact ? 22 : 27,
            color: 'var(--ssz-text-primary)',
          }}
        >
          {t('title')}
        </h1>
        <p
          className={compact ? 'mt-1 text-[14px] leading-[1.6]' : 'text-[15px] leading-[1.65]'}
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          {compact ? t('bodyCompact') : t('body')}
        </p>
      </div>

      {/* Feature rows (full layout only) */}
      {!compact && (
        <div className="flex w-full flex-col gap-[10px]">
          {FEATURES.map(({ icon: Icon, titleKey }) => (
            <div key={titleKey} className="flex items-start gap-[12px]">
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: PRIMARY_BG,
                  border: `1.5px solid ${PRIMARY_BD}`,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={16} style={{ color: PRIMARY_700 }} strokeWidth={1.5} />
              </div>
              <div>
                <div
                  className="text-[14px] font-semibold"
                  style={{ color: 'var(--ssz-text-primary)' }}
                >
                  {t(`features.${titleKey}.title`)}
                </div>
                <div className="text-[13px]" style={{ color: 'var(--ssz-text-muted)' }}>
                  {t(`features.${titleKey}.sub`)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex flex-col gap-[8px]"
        style={{ width: compact ? 'auto' : '100%', alignItems: compact ? 'flex-start' : 'stretch' }}
      >
        <button
          type="button"
          onClick={onTakePlacement}
          className="inline-flex items-center justify-center gap-[6px] rounded-xl px-6 py-[13px] text-[15px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{
            background: PRIMARY,
            boxShadow: 'var(--ssz-shadow-sm)',
            width: compact ? 'auto' : '100%',
          }}
        >
          {t('takePlacement')}
          <ArrowRight size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onSkipToBeginning}
          className="py-2 text-[14px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          {t('skipToBeginning')}
        </button>
      </div>
    </div>
  );
}
