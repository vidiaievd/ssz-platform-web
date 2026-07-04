'use client';

import { useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePlacementStore } from './stores/placement-store';
import { usePlacementQuestion } from './use-placement-question';
import { PlacementIntro } from './components/placement-intro';
import { PlacementQuestionRunner } from './components/placement-question-runner';
import { PlacementResult } from './components/placement-result';
import { PlacementSkipped } from './components/placement-skipped';
import { PlacementLoading } from './components/placement-loading';
import { PlacementError } from './components/placement-error';
import type { PlacementModuleRow } from './types';

/* ── header ─────────────────────────────────────────────────────────────────── */

interface ShellHeaderProps {
  showSkip: boolean;
  onSkip: () => void;
}

function ShellHeader({ showSkip, onSkip }: ShellHeaderProps) {
  const t = useTranslations('Placement');

  return (
    <header
      className="flex shrink-0 items-center justify-between border-b px-6 py-[14px]"
      style={{ borderColor: 'var(--ssz-border-default)', background: 'var(--ssz-bg-base)' }}
    >
      {/* Brand mark */}
      <div className="flex items-center gap-[8px]">
        <div
          aria-hidden="true"
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--ssz-color-primary-500)',
          }}
        >
          <Globe size={14} color="#fff" strokeWidth={1.5} />
        </div>
        <span
          className="text-[14px] font-semibold"
          style={{ color: 'var(--ssz-text-primary)' }}
        >
          SSZ Learn
        </span>
      </div>

      {/* 3-step breadcrumb */}
      <nav aria-label="Onboarding steps" className="flex items-center gap-[8px]">
        {[
          t('onboarding.account'),
          t('onboarding.chooseCourse'),
          t('onboarding.placement'),
        ].map((label, i, arr) => (
          <span key={label} className="flex items-center gap-[8px]">
            <span
              className={
                i === arr.length - 1
                  ? 'rounded-full px-[10px] py-[3px] text-[12px] font-bold text-white'
                  : 'text-[12.5px] font-medium'
              }
              style={
                i === arr.length - 1
                  ? { background: 'var(--ssz-color-primary-500)' }
                  : { color: 'var(--ssz-text-muted)' }
              }
            >
              {label}
            </span>
            {i < arr.length - 1 && (
              <span aria-hidden="true" style={{ color: 'var(--ssz-border-strong)', fontSize: 12 }}>
                ›
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* "Skip for now" — only during in-progress */}
      <div style={{ width: 100, textAlign: 'right' }}>
        {showSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-[13px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
            {t('runner.skipForNow')}
          </button>
        )}
      </div>
    </header>
  );
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementFullscreenShellProps {
  targetLanguage: string;
  /** Optional course module list — enables the result course-map. */
  modules?: PlacementModuleRow[];
  /** Called with the 1-based module index the student should start at. */
  onModuleSelect: (moduleIndex: number) => void;
}

export function PlacementFullscreenShell({
  targetLanguage,
  modules,
  onModuleSelect,
}: PlacementFullscreenShellProps) {
  const configure         = usePlacementStore((s) => s.configure);
  const flowState         = usePlacementStore((s) => s.flowState);
  const placedLevelId     = usePlacementStore((s) => s.placedLevelId);
  const placedModuleIndex = usePlacementStore((s) => s.placedModuleIndex);
  const startTest         = usePlacementStore((s) => s.startTest);
  const skipTest          = usePlacementStore((s) => s.skipTest);
  const retryLoad         = usePlacementStore((s) => s.retryLoad);
  const reset             = usePlacementStore((s) => s.reset);
  const overrideToModule1 = usePlacementStore((s) => s.overrideToModule1);

  usePlacementQuestion(targetLanguage);

  useEffect(() => {
    configure('fullscreen');
  }, [configure]);

  const placedModule = modules?.find((m) => m.index === placedModuleIndex);

  return (
    <div
      className="flex h-dvh flex-col"
      style={{ background: 'var(--ssz-bg-base)', color: 'var(--ssz-text-primary)' }}
    >
      <ShellHeader
        showSkip={flowState === 'in-progress'}
        onSkip={skipTest}
      />

      <main className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-12">
        {flowState === 'intro' && (
          <PlacementIntro
            onTakePlacement={startTest}
            onSkipToBeginning={skipTest}
          />
        )}

        {flowState === 'loading' && <PlacementLoading />}

        {flowState === 'in-progress' && (
          <PlacementQuestionRunner onSkipForNow={skipTest} />
        )}

        {flowState === 'result' && placedLevelId !== null && placedModuleIndex !== null && (
          <PlacementResult
            placedLevelId={placedLevelId}
            placedModuleIndex={placedModuleIndex}
            placedModuleTitle={placedModule?.title}
            modules={modules}
            onStartAtModule={onModuleSelect}
            onStartFromModule1={() => {
              overrideToModule1();
              onModuleSelect(1);
            }}
          />
        )}

        {flowState === 'skipped' && (
          <PlacementSkipped
            onGoToModule1={() => onModuleSelect(1)}
            onRetakePlacement={() => {
              reset();
              startTest();
            }}
          />
        )}

        {flowState === 'error' && (
          <PlacementError
            onRetry={retryLoad}
            onStartFromBeginning={skipTest}
          />
        )}
      </main>
    </div>
  );
}
