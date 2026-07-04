'use client';

import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { AccessMarker } from './access-marker';
import type { AccessState } from './access-marker';

/** The action the CTA button performs — distinct from the AccessMarker display state. */
export type CtaState = 'enroll' | 'request' | 'purchase' | 'continue' | 'locked';

/** Derive the CTA action from a container's accessTier + enrollment flag. */
export function resolveCtaState(accessTier: string, isEnrolled = false): CtaState {
  if (isEnrolled) return 'continue';
  switch (accessTier) {
    case 'public_free':           return 'enroll';
    case 'public_paid':           return 'purchase';
    case 'free_within_school':
    case 'assigned_only':         return 'request';
    case 'entitlement_required':  return 'locked';
    default:                      return 'enroll';
  }
}

/** Map CTA state to the corresponding AccessMarker display state. */
function ctaToMarkerState(cta: CtaState): AccessState {
  switch (cta) {
    case 'enroll':   return 'free';
    case 'request':  return 'school';
    case 'purchase': return 'paid';
    case 'continue': return 'enrolled';
    case 'locked':   return 'locked';
  }
}

export interface AccessPanelProps {
  state: CtaState;
  schoolName?: string | null;
  price?: number | null;
  /** 0–100 progress percent — shown only for "continue" state */
  progressPercent?: number;
  onCta: () => void;
  onPreview: () => void;
}

export function AccessPanel({
  state,
  schoolName,
  price,
  progressPercent,
  onCta,
  onPreview,
}: AccessPanelProps) {
  const t = useTranslations('Catalog');

  const markerLabels = {
    enrolled: t('enrolled'),
    locked:   t('locked'),
    free:     t('free'),
  };

  const cfg: Record<
    CtaState,
    { ctaLabel: string; ctaDisabled?: boolean; note: string; showPrice: boolean }
  > = {
    enroll: {
      ctaLabel:   t('ctaEnroll'),
      note:       t('noteEnroll'),
      showPrice:  true,
    },
    request: {
      ctaLabel:   t('ctaRequest'),
      note:       t('noteRequest'),
      showPrice:  true,
    },
    purchase: {
      ctaLabel:   t('ctaPurchase'),
      note:       t('notePurchase'),
      showPrice:  true,
    },
    continue: {
      ctaLabel:   t('ctaContinue'),
      note:       t('noteContinue'),
      showPrice:  false,
    },
    locked: {
      ctaLabel:   t('locked'),
      ctaDisabled: true,
      note:       t('noteLocked'),
      showPrice:  false,
    },
  };

  const c = cfg[state];

  return (
    <div
      style={{
        background: 'var(--ssz-bg-surface)',
        borderRadius: 16,
        padding: 20,
        border: '1.5px solid var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'sticky',
        top: 24,
      }}
    >
      {/* top row: access marker + price */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <AccessMarker
          state={ctaToMarkerState(state)}
          schoolName={schoolName}
          price={price}
          labels={markerLabels}
        />
        {c.showPrice && (
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ssz-text-primary)',
            }}
          >
            {state === 'purchase' && price != null ? `€${price}` : t('free')}
          </span>
        )}
      </div>

      {/* progress bar — continue state only */}
      {state === 'continue' && progressPercent != null && (
        <div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: 'var(--ssz-bg-muted)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 999,
                background: 'var(--ssz-color-primary-500)',
                width: `${progressPercent}%`,
                transition: 'width 300ms',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ssz-text-muted)', marginTop: 6 }}>
            {t('progressCaption', { pct: progressPercent })}
          </div>
        </div>
      )}

      {/* primary CTA */}
      <Button
        className="w-full justify-center"
        style={{ fontSize: 15, padding: '13px 20px' }}
        disabled={c.ctaDisabled}
        onClick={c.ctaDisabled ? undefined : onCta}
        variant={state === 'purchase' ? 'secondary' : 'primary'}
      >
        {c.ctaLabel}
      </Button>

      {/* secondary preview link — hidden once enrolled */}
      {state !== 'continue' && (
        <button
          type="button"
          onClick={onPreview}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            fontFamily: 'var(--ssz-font-ui)',
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--ssz-color-primary-500)',
          }}
        >
          <Play size={13} color="var(--ssz-color-primary-500)" aria-hidden="true" />
          {t('previewUnit')}
        </button>
      )}

      {/* note line */}
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--ssz-text-secondary)',
          lineHeight: 1.55,
          paddingTop: 12,
          borderTop: '1px solid var(--ssz-border-default)',
        }}
      >
        {c.note}
      </div>
    </div>
  );
}
