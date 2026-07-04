'use client';

import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { PlacementLevelId, PlacementModuleRow } from '../types';

/* ── design tokens ──────────────────────────────────────────────────────────── */
const PRIMARY        = 'var(--ssz-color-primary-500)';
const PRIMARY_SUBTLE = 'oklch(0.62 0.105 168 / 0.05)';
const PRIMARY_BD     = 'oklch(0.62 0.105 168 / 0.35)';
const SUCCESS_500    = 'var(--ssz-color-success-500)';
const SUCCESS_700    = 'var(--ssz-color-success-700)';
const SUCCESS_BG     = 'var(--ssz-color-success-50)';
const SUCCESS_BD     = 'var(--ssz-color-success-200)';

/* ── icon tile ───────────────────────────────────────────────────────────────── */
function SuccessIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: SUCCESS_BG,
        border: `1.5px solid ${SUCCESS_BD}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CheckCircle2 size={28} style={{ color: SUCCESS_500 }} strokeWidth={1.5} />
    </div>
  );
}

/* ── module row ─────────────────────────────────────────────────────────────── */
interface ModuleRowProps {
  module: PlacementModuleRow;
  status: 'known' | 'start' | 'future';
  t: ReturnType<typeof useTranslations<'Placement.result'>>;
}

function ModuleRow({ module, status, t }: ModuleRowProps) {
  const isKnown = status === 'known';
  const isStart = status === 'start';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: isStart ? '14px 16px' : '11px 16px',
        borderRadius: 12,
        border: isStart ? `2px solid ${PRIMARY_BD}` : '1.5px solid var(--ssz-border-default)',
        background: isStart ? PRIMARY_SUBTLE : 'transparent',
        transition: 'all 200ms var(--ssz-ease-out)',
      }}
    >
      {/* Number / check badge */}
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isKnown ? SUCCESS_BG : isStart ? PRIMARY : 'var(--ssz-bg-muted)',
          border: `1.5px solid ${isKnown ? SUCCESS_BD : isStart ? PRIMARY : 'var(--ssz-border-default)'}`,
        }}
      >
        {isKnown ? (
          <CheckCircle2 size={14} style={{ color: SUCCESS_700 }} strokeWidth={2} />
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isStart ? '#fff' : 'var(--ssz-text-muted)',
            }}
          >
            {module.index}
          </span>
        )}
      </div>

      {/* Title + can-do */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="truncate text-[14px] font-semibold"
          style={{
            color: isKnown
              ? 'var(--ssz-text-muted)'
              : isStart
              ? 'var(--ssz-text-primary)'
              : 'var(--ssz-text-secondary)',
          }}
        >
          {module.title}
        </div>
        {module.canDoStatement && (
          <div className="truncate text-[12px]" style={{ color: 'var(--ssz-text-muted)', marginTop: 1 }}>
            {module.canDoStatement}
          </div>
        )}
      </div>

      {/* Badge */}
      {(isKnown || isStart) && (
        <span
          style={{
            flexShrink: 0,
            padding: '2px 9px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            background: isKnown ? SUCCESS_BG : PRIMARY,
            color: isKnown ? SUCCESS_700 : '#fff',
            border: `1px solid ${isKnown ? SUCCESS_BD : PRIMARY}`,
          }}
        >
          {isKnown ? t('known') : t('startHere')}
        </span>
      )}
    </div>
  );
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementResultProps {
  placedLevelId: PlacementLevelId;
  placedModuleIndex: number;
  /** Full course module list (optional — renders map when provided). */
  modules?: PlacementModuleRow[];
  placedModuleTitle?: string;
  onStartAtModule: (moduleIndex: number) => void;
  onStartFromModule1: () => void;
}

export function PlacementResult({
  placedLevelId,
  placedModuleIndex,
  modules,
  placedModuleTitle,
  onStartAtModule,
  onStartFromModule1,
}: PlacementResultProps) {
  const t = useTranslations('Placement.result');

  const titleText = placedModuleTitle
    ? t('title', { n: placedModuleIndex, moduleTitle: placedModuleTitle })
    : t('titleFallback', { n: placedModuleIndex });

  return (
    <div className="flex w-full flex-col gap-[28px]" style={{ maxWidth: 480 }}>
      {/* Header */}
      <div className="flex flex-col items-center gap-[14px] text-center">
        <SuccessIcon />
        <div>
          <p
            className="mb-1 text-[11px] font-bold uppercase"
            style={{ letterSpacing: '0.07em', color: 'var(--ssz-text-muted)' }}
          >
            {t('eyebrow')}
          </p>
          <h1
            className="font-bold leading-[1.25]"
            style={{ fontSize: 26, color: 'var(--ssz-text-primary)' }}
          >
            {titleText}
          </h1>
          <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: 'var(--ssz-text-secondary)' }}>
            {t.rich('sub', {
              level: placedLevelId,
              strong: (chunks) => <strong style={{ color: 'var(--ssz-text-primary)' }}>{chunks}</strong>,
            })}
          </p>
        </div>
      </div>

      {/* Course map (optional) */}
      {modules && modules.length > 0 && (
        <div className="flex flex-col gap-[6px]">
          {modules.map((mod) => {
            const status =
              mod.index < placedModuleIndex
                ? 'known'
                : mod.index === placedModuleIndex
                ? 'start'
                : 'future';
            return <ModuleRow key={mod.index} module={mod} status={status} t={t} />;
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-[10px]">
        <button
          type="button"
          onClick={() => onStartAtModule(placedModuleIndex)}
          className="inline-flex w-full items-center justify-center gap-[6px] rounded-xl px-6 py-[13px] text-[15px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{
            background: PRIMARY,
            boxShadow: 'var(--ssz-shadow-sm)',
          }}
        >
          {t('startAt', { n: placedModuleIndex })}
          <ArrowRight size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onStartFromModule1}
          className="py-2 text-[14px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          {t('startFromModule1')}
        </button>
      </div>
    </div>
  );
}
