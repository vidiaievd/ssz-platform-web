'use client';

import { useState, useTransition, useId, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { savePrefsStepAction, skipPrefsStepAction } from '../../actions/save-prefs-step';
import { useOnboardingStore } from '../../stores/onboarding-store';
import type { CEFRLevel, TargetLanguage } from '../../stores/onboarding-store';
import { LanguageCombobox } from './language-combobox';
import { LanguagesIllustration } from './languages-illustration';
import { TargetLanguageRow } from './target-language-row';

type StepPrefsProps = {
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onDone: () => void;
};

export function StepPrefs({ headingRef, onBack, onDone }: StepPrefsProps) {
  const t = useTranslations('Onboarding');
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();
  const liveRegionId = useId();
  const skipCalloutRef = useRef<HTMLButtonElement>(null);

  const { languagesDraft, setLanguagesDraft } = useOnboardingStore();
  const [nativeLanguage, setNativeLanguage] = useState(languagesDraft.nativeLanguage);
  const [targets, setTargets] = useState<TargetLanguage[]>(languagesDraft.targetLanguages);
  const [newRowIdx, setNewRowIdx] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [nativeError, setNativeError] = useState('');
  const [skipCalloutVisible, setSkipCalloutVisible] = useState(false);

  // Move focus to "Skip anyway" when callout appears
  useEffect(() => {
    if (skipCalloutVisible) {
      skipCalloutRef.current?.focus();
    }
  }, [skipCalloutVisible]);

  const targetExcluded = (idx: number) =>
    [nativeLanguage, ...targets.filter((_, i) => i !== idx).map((t) => t.code)].filter(Boolean);

  function addTarget() {
    const updated = [...targets, { code: '' }];
    setTargets(updated);
    setNewRowIdx(updated.length - 1);
    syncDraft(nativeLanguage, updated);
    setSkipCalloutVisible(false);
  }

  function updateTargetCode(idx: number, code: string) {
    const updated = targets.map((t, i) => (i === idx ? { ...t, code } : t));
    setTargets(updated);
    syncDraft(nativeLanguage, updated);
  }

  function updateTargetLevel(idx: number, level: CEFRLevel) {
    const updated = targets.map((t, i) => (i === idx ? { ...t, level } : t));
    setTargets(updated);
    syncDraft(nativeLanguage, updated);
  }

  function removeTarget(idx: number) {
    const removed = targets[idx];
    const updated = targets.filter((_, i) => i !== idx);
    setTargets(updated);
    setNewRowIdx(null);
    syncDraft(nativeLanguage, updated);
    if (removed?.code) {
      setLiveMessage(t('prefs.targets.removed', { language: removed.code }));
    }
  }

  function handleNativeChange(code: string) {
    setNativeLanguage(code);
    setNativeError('');
    syncDraft(code, targets);
  }

  function syncDraft(native: string, tgts: TargetLanguage[]) {
    setLanguagesDraft({ nativeLanguage: native, targetLanguages: tgts });
  }

  function validate(): boolean {
    if (!nativeLanguage) {
      setNativeError(t('prefs.native.error.required'));
      return false;
    }
    return true;
  }

  function handleFinish() {
    if (!validate()) return;

    const incompleteIdx = targets.findIndex((t) => !t.code);
    if (incompleteIdx !== -1) {
      toast.error(t('error.saveFailed'));
      return;
    }

    startTransition(async () => {
      const result = await savePrefsStepAction({
        nativeLanguage,
        targetLanguages: targets,
      });
      if (!result.ok) {
        toast.error(t('error.saveFailed'));
        return;
      }
      onDone();
    });
  }

  function handleSkipLinkClick() {
    setSkipCalloutVisible(true);
  }

  function handleSkipConfirm() {
    startSkipTransition(async () => {
      const result = await skipPrefsStepAction();
      if (!result.ok) {
        toast.error(t('error.saveFailed'));
        return;
      }
      onDone();
    });
  }

  const isLoading = isPending || isSkipping;

  return (
    <div className="space-y-6">
      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-(--ssz-text-primary) focus:outline-none"
        >
          {t('step.prefs.title')}
        </h1>
        <p className="mt-2 text-(--ssz-text-secondary) leading-relaxed">{t('step.prefs.subtitle')}</p>
      </div>

      {/* Native language */}
      <Field
        label={t('prefs.native.label')}
        htmlFor="native-language"
        error={nativeError}
        required
      >
        <LanguageCombobox
          id="native-language"
          value={nativeLanguage}
          onChange={handleNativeChange}
          placeholder={t('prefs.native.placeholder')}
          exclude={targets.map((t) => t.code).filter(Boolean)}
          disabled={isLoading}
        />
      </Field>

      {/* Target languages */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('prefs.targets.heading')}</p>

        {targets.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <LanguagesIllustration className="h-24 w-32" />
            <div>
              <p className="font-medium text-(--ssz-text-primary)">{t('targets.empty.title')}</p>
              <p className="mt-1 text-sm text-(--ssz-text-secondary)">{t('targets.empty.body')}</p>
            </div>
            <Button type="button" variant="outline" onClick={addTarget} disabled={isLoading}>
              {t('targets.empty.cta')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {targets.map((target, idx) => (
              <TargetLanguageRow
                key={idx}
                code={target.code}
                level={target.level ?? ''}
                excludeCodes={targetExcluded(idx)}
                onCodeChange={(code) => updateTargetCode(idx, code)}
                onLevelChange={(level) => updateTargetLevel(idx, level)}
                onRemove={() => removeTarget(idx)}
                disabled={isLoading}
                autoFocus={newRowIdx === idx}
                removeLabel={t('prefs.targets.remove', { language: target.code || '…' })}
                languagePlaceholder={t('prefs.native.placeholder')}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addTarget}
              disabled={isLoading || targets.length >= 10}
              className="w-full border-dashed"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('prefs.targets.add')}
            </Button>
          </div>
        )}
      </div>

      {/* Skip affordance — inline callout, not AlertDialog */}
      <div className="space-y-3">
        {!skipCalloutVisible && (
          <button
            type="button"
            onClick={handleSkipLinkClick}
            disabled={isLoading}
            className="text-sm text-(--ssz-text-muted) underline-offset-4 hover:underline disabled:opacity-50"
          >
            {t('skip.label')}
          </button>
        )}

        {skipCalloutVisible && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-subtle px-4 py-3 space-y-3"
          >
            <p className="text-sm text-(--ssz-text-secondary)">{t('skip.callout.body')}</p>
            <div className="flex items-center gap-2">
              <Button
                ref={skipCalloutRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSkipConfirm}
                disabled={isLoading}
                loading={isSkipping}
              >
                {t('skip.callout.confirm')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={addTarget}
                disabled={isLoading}
              >
                {t('skip.callout.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Screen-reader live region for add/remove announcements */}
      <div id={liveRegionId} aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading}>
          {t('back')}
        </Button>

        <Button
          type="button"
          onClick={handleFinish}
          disabled={isLoading}
          loading={isPending}
        >
          {t('finishCta')}
        </Button>
      </div>
    </div>
  );
}
