import { CheckCircle, Lock, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { SectionChips } from './section-chips';

export interface ModuleRowProps {
  /** 0-based index */
  index: number;
  title: string;
  /** True when the student has already completed this module */
  done?: boolean;
  /** True for the one free preview module */
  isPreview?: boolean;
  /** True when module is behind the enrollment gate */
  locked: boolean;
  /** Called when the "Preview a unit" button is clicked */
  onPreview?: () => void;
}

export function ModuleRow({ index, title, done, isPreview, locked, onPreview }: ModuleRowProps) {
  const t = useTranslations('Catalog');
  const num = String(index + 1).padStart(2, '0');

  /* badge index colors */
  const badgeBg = done
    ? 'var(--ssz-color-success-100)'
    : locked
      ? 'var(--ssz-bg-subtle)'
      : 'var(--ssz-color-primary-100)';
  const badgeClr = done
    ? 'var(--ssz-color-success-700)'
    : locked
      ? 'var(--ssz-text-muted)'
      : 'var(--ssz-color-primary-700)';

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '16px 18px',
        borderRadius: 12,
        border: '1.5px solid var(--ssz-border-default)',
        background: 'var(--ssz-bg-surface)',
        opacity: locked ? 0.62 : 1,
      }}
    >
      {/* index badge */}
      <div
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--ssz-font-mono)',
          fontSize: 13,
          fontWeight: 700,
          background: badgeBg,
          color: badgeClr,
        }}
      >
        {done ? (
          <CheckCircle size={17} color="var(--ssz-color-success-700)" aria-hidden="true" />
        ) : locked ? (
          <Lock size={14} color="var(--ssz-text-muted)" aria-hidden="true" />
        ) : (
          num
        )}
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--ssz-text-muted)',
            }}
          >
            {t('moduleLabel', { n: index + 1 })}
          </span>

          {isPreview && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--ssz-color-primary-700)',
                background: 'var(--ssz-color-primary-100)',
                padding: '2px 7px',
                borderRadius: 999,
              }}
            >
              {t('freePreview')}
            </span>
          )}

          {done && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--ssz-color-success-700)',
                background: 'var(--ssz-color-success-100)',
                padding: '2px 7px',
                borderRadius: 999,
              }}
            >
              {t('done')}
            </span>
          )}

          {locked && !isPreview && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--ssz-text-muted)',
              }}
            >
              <Lock size={11} aria-hidden="true" />
              {t('enrollToUnlock')}
            </span>
          )}
        </div>

        {/* can-do goal */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ssz-text-primary)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Target size={15} color="var(--ssz-color-primary-500)" aria-hidden="true" />
          {title}
        </div>

        <SectionChips dim={locked && !isPreview} />

        {isPreview && onPreview && (
          <div style={{ marginTop: 10 }}>
            <Button variant="outline" size="sm" onClick={onPreview}>
              {t('previewUnit')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
