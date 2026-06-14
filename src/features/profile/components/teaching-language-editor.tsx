'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

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
  /** Currently saved languages (rendered as disabled rows). */
  languages: TeachingLanguageEntry[];
  /** Called when the user completes a new draft row. Must throw on failure. */
  onAdd: (code: string, level: string) => Promise<void>;
  /** Called when the user clicks × on a saved row. */
  onRemove: (code: string) => void;
  /** Available level options — defaults to CEFR A1–C2. */
  levels?: readonly string[];
  levelPlaceholder?: string;
  addLabel?: string;
  removeLabelFn?: (code: string) => string;
  languagePlaceholder?: string;
  disabled?: boolean;
  maxLanguages?: number;
};

/**
 * Reusable teaching-language rows editor.
 *
 * Saved rows (from `languages` prop) are read-only — language code is fixed,
 * level is fixed; only removal is allowed. New draft rows are fully editable
 * and auto-submit once both a language and a level are selected.
 *
 * Extracted from the onboarding StepTutor pattern so it can be reused on the
 * profile settings page connected to the TeachingProfile API.
 */
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

  async function updateDraftLevel(idx: number, level: string) {
    const row = draftRows[idx];
    if (!row) return;
    const next = { code: row.code, level };
    setDraftRows((prev) => prev.map((r, i) => (i === idx ? next : r)));

    if (!next.code) return;

    setSubmittingIdx(idx);
    try {
      await onAdd(next.code, next.level);
      // On success the parent's `languages` prop will update via query invalidation.
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

      {/* Draft rows — editable, auto-submit on complete */}
      {draftRows.map((row, idx) => (
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
            onValueChange={(level) => void updateDraftLevel(idx, level)}
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
      ))}

      {/* Add button — matches onboarding style */}
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
