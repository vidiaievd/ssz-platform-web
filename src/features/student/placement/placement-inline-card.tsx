'use client';

import { useEffect, useRef } from 'react';
import { X, Target } from 'lucide-react';
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

function dismissedKey(containerId: string) {
  return `placement-prompt-dismissed:${containerId}`;
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementInlineCardProps {
  /** Used to scope the localStorage dismissed flag. */
  containerId: string;
  targetLanguage: string;
  modules?: PlacementModuleRow[];
  /**
   * Called when the student picks a starting module.
   * If omitted the card simply collapses (student stays on the current page).
   */
  onModuleSelect?: (moduleIndex: number) => void;
  /** Called once when a placement result is first computed. Best-effort; do not throw. */
  onResult?: (placedLevelId: string, placedModuleIndex: number) => void;
}

export function PlacementInlineCard({
  containerId,
  targetLanguage,
  modules,
  onModuleSelect,
  onResult,
}: PlacementInlineCardProps) {
  const t = useTranslations('Placement');

  const configure         = usePlacementStore((s) => s.configure);
  const flowState         = usePlacementStore((s) => s.flowState);
  const cardDismissed     = usePlacementStore((s) => s.cardDismissed);
  const placedLevelId     = usePlacementStore((s) => s.placedLevelId);
  const placedModuleIndex = usePlacementStore((s) => s.placedModuleIndex);
  const startTest         = usePlacementStore((s) => s.startTest);
  const skipTest          = usePlacementStore((s) => s.skipTest);
  const retryLoad         = usePlacementStore((s) => s.retryLoad);
  const reset             = usePlacementStore((s) => s.reset);
  const overrideToModule1 = usePlacementStore((s) => s.overrideToModule1);
  const dismissCard       = usePlacementStore((s) => s.dismissCard);
  const reopenCard        = usePlacementStore((s) => s.reopenCard);

  usePlacementQuestion(targetLanguage);

  useEffect(() => {
    configure('inline');
    // Restore localStorage-persisted dismissed state after configuring
    if (typeof window !== 'undefined') {
      const wasDismissed = window.localStorage.getItem(dismissedKey(containerId)) === '1';
      if (wasDismissed) {
        dismissCard();
      }
    }
  }, [configure, containerId, dismissCard]);

  // Fire onResult once when a placement result is first computed.
  // Using a ref to always call the latest onResult without re-triggering the effect.
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; });
  useEffect(() => {
    if (flowState !== 'result' || placedLevelId === null || placedModuleIndex === null) return;
    onResultRef.current?.(placedLevelId, placedModuleIndex);
  }, [flowState, placedLevelId, placedModuleIndex]);

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(dismissedKey(containerId), '1');
    }
    dismissCard();
  }

  function handleReopen() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(dismissedKey(containerId));
    }
    reopenCard();
  }

  function handleModuleSelect(moduleIndex: number) {
    onModuleSelect?.(moduleIndex);
    // Persist dismissed so the card doesn't re-appear
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(dismissedKey(containerId), '1');
    }
    dismissCard();
  }

  const placedModule = modules?.find((m) => m.index === placedModuleIndex);

  /* ── collapsed state: small text link ──────────────────────────────────────── */
  if (cardDismissed) {
    return (
      <button
        type="button"
        onClick={handleReopen}
        className="mb-4 flex items-center gap-[6px] text-[13px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
        style={{ color: 'var(--ssz-text-muted)' }}
      >
        <Target size={13} aria-hidden="true" />
        {t('inline.offerText')}
      </button>
    );
  }

  /* ── card ────────────────────────────────────────────────────────────────────── */
  // Dismiss (✕) only allowed in intro state — once in progress, no accidental loss
  const showDismiss = flowState === 'intro';

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'var(--ssz-border-default)',
        background: 'var(--ssz-bg-surface)',
        boxShadow: 'var(--ssz-shadow-md)',
        padding: '22px 24px',
      }}
    >
      {showDismiss && (
        <button
          type="button"
          aria-label={t('inline.dismiss')}
          onClick={handleDismiss}
          className="absolute right-3 top-3 flex items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-[var(--ssz-bg-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}

      <div className="flex flex-col items-start">
        {flowState === 'intro' && (
          <PlacementIntro
            compact
            onTakePlacement={startTest}
            onSkipToBeginning={() => {
              handleDismiss();
              skipTest();
            }}
          />
        )}

        {flowState === 'loading' && (
          <div className="w-full">
            <PlacementLoading />
          </div>
        )}

        {flowState === 'in-progress' && (
          <div className="w-full">
            <PlacementQuestionRunner />
          </div>
        )}

        {flowState === 'result' && placedLevelId !== null && placedModuleIndex !== null && (
          <PlacementResult
            placedLevelId={placedLevelId}
            placedModuleIndex={placedModuleIndex}
            placedModuleTitle={placedModule?.title}
            modules={modules}
            onStartAtModule={handleModuleSelect}
            onStartFromModule1={() => {
              overrideToModule1();
              handleModuleSelect(1);
            }}
          />
        )}

        {flowState === 'skipped' && (
          <PlacementSkipped
            onGoToModule1={() => handleModuleSelect(1)}
            onRetakePlacement={() => {
              reset();
              startTest();
            }}
          />
        )}

        {flowState === 'error' && (
          <PlacementError
            onRetry={retryLoad}
            onStartFromBeginning={() => {
              skipTest();
            }}
          />
        )}
      </div>
    </div>
  );
}
