'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { CEFR_LEVELS } from '../lib/cefr-levels';
import { LanguageCombobox } from './onboarding/language-combobox';

export type TeachingLanguageEntry = { code: string; level: string };

type DraftRow = TeachingLanguageEntry;

type Props = {
  languages: TeachingLanguageEntry[];
  onAdd: (code: string, level: string) => Promise<void>;
  onRemove: (code: string) => void;
  levels?: readonly string[];
  levelPlaceholder?: string;
  addLabel?: string;
  removeLabelFn?: (code: string) => string;
  languagePlaceholder?: string;
  disabled?: boolean;
  maxLanguages?: number;
};

export function TeachingLanguageEditor({
  languages,
  onAdd,
  onRemove,
  levels = CEFR_LEVELS,
  levelPlaceholder = 'Level',
  addLabel = 'Add a language',
  removeLabelFn = (code) => `Remove ${code}`,
  languagePlaceholder = 'Select a language…',
  disabled = false,
  maxLanguages = 10,
}: Props) {
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [submittingIdx, setSubmittingIdx] = useState<number | null>(null);

  const savedCodes = languages.map((l) => l.code);
  const draftCodes = draftRows.map((r) => r.code).filter(Boolean);

  function excludeForDraft(idx: number) {
    return [...savedCodes, ...draftCodes.filter((_, i) => i !== idx)];
  }

  function addRow() {
    if (savedCodes.length + draftRows.length >= maxLanguages) return;
    setDraftRows((prev) => [...prev, { code: '', level: '' }]);
  }

  function removeDraftRow(idx: number) {
    setDraftRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDraftCode(idx: number, code: string) {
    setDraftRows((prev) => prev.map((r, i) => (i === idx ? { ...r, code } : r)));
  }

  function updateDraftLevel(idx: number, level: string) {
    setDraftRows((prev) => prev.map((r, i) => (i === idx ? { ...r, level } : r)));
  }

  async function submitDraftRow(idx: number) {
    const row = draftRows[idx];
    if (!row || !row.code || !row.level) return;

    setSubmittingIdx(idx);
    try {
      await onAdd(row.code, row.level);
      setDraftRows((prev) => prev.filter((_, i) => i !== idx));
    } finally {
      setSubmittingIdx(null);
    }
  }

  const canAddMore = savedCodes.length + draftRows.length < maxLanguages;
  const isDisabled = disabled || submittingIdx !== null;

  return (
    <div className="space-y-2">
      {/* Saved rows — read-only, removable */}
      {languages.map((lang) => (
        <div key={lang.code} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <LanguageCombobox
              value={lang.code}
              onChange={() => {}}
              placeholder=""
              disabled
            />
          </div>
          <Select value={lang.level} disabled>
            <SelectTrigger className="w-24 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {levels.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(lang.code)}
            disabled={isDisabled}
            aria-label={removeLabelFn(lang.code)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Draft rows — editable, explicit Add button */}
      {draftRows.map((row, idx) => {
        const isSubmitting = submittingIdx === idx;
        const canSubmit = !!row.code && !!row.level;
        return (
          <div key={idx} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <LanguageCombobox
                value={row.code}
                onChange={(code) => updateDraftCode(idx, code)}
                placeholder={languagePlaceholder}
                exclude={excludeForDraft(idx)}
                disabled={isDisabled}
              />
            </div>
            <Select
              value={row.level}
              onValueChange={(level) => updateDraftLevel(idx, level)}
              disabled={isDisabled || !row.code}
            >
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue placeholder={levelPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {levels.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitDraftRow(idx)}
              disabled={!canSubmit || isDisabled}
              className="shrink-0 h-10"
              aria-label="Add language"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeDraftRow(idx)}
              disabled={isDisabled}
              aria-label="Cancel"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      {canAddMore && (
        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          disabled={isDisabled}
          className="w-full border-dashed"
        >
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
