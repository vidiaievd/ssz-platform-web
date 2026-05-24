'use client';

import { useEffect, useId } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CEFRLevel } from '../../stores/onboarding-store';
import { CEFRLevelPicker } from './cefr-level-picker';
import { LanguageCombobox } from './language-combobox';

type TargetLanguageRowProps = {
  code: string;
  level: CEFRLevel | '';
  excludeCodes: string[];
  onCodeChange: (code: string) => void;
  onLevelChange: (level: CEFRLevel) => void;
  onRemove: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  removeLabel: string;
  searchPlaceholder?: string;
  languagePlaceholder?: string;
};

export function TargetLanguageRow({
  code,
  level,
  excludeCodes,
  onCodeChange,
  onLevelChange,
  onRemove,
  disabled,
  autoFocus,
  removeLabel,
  searchPlaceholder,
  languagePlaceholder = 'Select language',
}: TargetLanguageRowProps) {
  const comboboxId = useId();

  useEffect(() => {
    if (autoFocus) {
      document.getElementById(comboboxId)?.focus();
    }
  }, [autoFocus, comboboxId]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
      <div className="flex-1 min-w-0">
        <LanguageCombobox
          id={comboboxId}
          value={code}
          onChange={onCodeChange}
          placeholder={languagePlaceholder}
          searchPlaceholder={searchPlaceholder}
          exclude={excludeCodes}
          disabled={disabled}
        />
      </div>
      <CEFRLevelPicker
        value={level}
        onChange={onLevelChange}
        disabled={disabled || !code}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
        className="shrink-0 self-center sm:mt-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
