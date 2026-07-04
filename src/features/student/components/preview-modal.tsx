'use client';

import { useEffect, useRef } from 'react';
import { X, Volume2, Play, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  /** The can-do goal text for the preview module */
  canDoGoal: string;
  /** Language code for the course (drives tint) */
  langCode: string;
  /** Primary CTA label matching the AccessPanel state */
  ctaLabel: string;
  onCta: () => void;
}

const LANG_HUE: Record<string, number> = {
  nb: 200, no: 200, es: 28, uk: 82, fr: 300, de: 145, ja: 15, en: 250, ru: 0,
};
function hueOf(lang: string) { return LANG_HUE[lang.toLowerCase()] ?? 200; }
function hueSoft(h: number)  { return `oklch(0.95 0.03 ${h})`; }

export function PreviewModal({ open, onClose, canDoGoal, langCode, ctaLabel, onCta }: PreviewModalProps) {
  const t = useTranslations('Catalog');
  const dialogRef = useRef<HTMLDivElement>(null);
  const hue = hueOf(langCode);

  /* focus trap on open */
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { prev?.focus(); };
  }, [open]);

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* backdrop */
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--ssz-bg-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '24px 16px',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('freePreview')}
        tabIndex={-1}
        style={{
          background: 'var(--ssz-bg-surface)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 620,
          padding: '24px 24px 20px',
          boxShadow: 'var(--ssz-shadow-xl)',
          outline: 'none',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            style={{
              background: 'none',
              border: '1.5px solid var(--ssz-border-default)',
              borderRadius: 8,
              padding: '5px 8px',
              cursor: 'pointer',
              color: 'var(--ssz-text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* can-do goal header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Target size={16} color="var(--ssz-color-primary-500)" aria-hidden="true" />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ssz-text-primary)' }}>
            {canDoGoal}
          </span>
        </div>

        {/* anchor media block */}
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--ssz-border-default)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: 120,
              background: hueSoft(hue),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: 'var(--ssz-text-muted)',
              fontFamily: 'var(--ssz-font-mono)',
            }}
          >
            {t('previewCoverPlaceholder')}
          </div>
          <div
            style={{
              padding: '16px 18px',
              fontFamily: 'var(--ssz-font-reading)',
              fontSize: 15.5,
              lineHeight: 1.7,
              color: 'var(--ssz-text-primary)',
            }}
          >
            {t('previewPassage')}
          </div>
        </div>

        {/* audio row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--ssz-bg-subtle)',
            marginBottom: 18,
          }}
        >
          <Volume2 size={18} color="var(--ssz-color-primary-500)" aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ssz-text-primary)' }}>
              {t('listenToAudio')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ssz-text-muted)' }}>
              {t('audioCaption')}
            </div>
          </div>
          <button
            type="button"
            aria-label={t('playAudio')}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--ssz-color-primary-500)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={13} color="#fff" aria-hidden="true" />
          </button>
        </div>

        {/* primary CTA mirrors the page CTA */}
        <Button
          className="w-full justify-center"
          onClick={() => { onClose(); onCta(); }}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
