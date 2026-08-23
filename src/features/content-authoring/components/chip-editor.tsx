'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Input } from '@/components/ui/input';

export interface ChipEditorProps {
  values: readonly string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder: string;
  /** Names the field for screen readers, and names each chip's remove button. */
  label: string;
  /** `Remove “{value}”`, as a function so the caller keeps the translation. */
  removeLabel: (value: string) => string;
}

/**
 * A list of short strings the author builds one at a time — a writing task's point
 * keywords and useful phrases, a short answer's anchor phrases.
 *
 * Shared rather than owned by one builder, and moved here when the second one needed it:
 * the behaviour below is a rule from the handoffs, identical in both, and a second copy
 * would be a second place for the blur rule to be forgotten.
 *
 * It commits on Enter **and** on blur, which is the rule the handoff spells out and the
 * one that matters: an author who types a phrase and then clicks the next field has
 * finished typing it, and a field that threw the text away because they did not press
 * Enter would lose work in the most ordinary way there is.
 *
 * Every chip carries a labelled remove button rather than an `×` glyph, because the
 * glyph alone says "close" to a screen reader and gives no clue what is being closed.
 */
export function ChipEditor({
  values,
  onAdd,
  onRemove,
  placeholder,
  label,
  removeLabel,
}: ChipEditorProps) {
  const [draft, setDraft] = useState('');

  function commit() {
    if (draft.trim() === '') return;
    onAdd(draft);
    setDraft('');
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-full bg-(--ssz-bg-muted) py-0.5 pr-1 pl-2.5 text-xs"
        >
          {value}
          <button
            type="button"
            aria-label={removeLabel(value)}
            onClick={() => onRemove(value)}
            className="grid size-4 place-items-center rounded-full text-(--ssz-text-secondary) hover:bg-(--ssz-bg-subtle) hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        aria-label={label}
        placeholder={placeholder}
        className="h-7 w-40 text-xs"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          // The builder has no form to submit, but a stray Enter in a text field is a
          // page reload waiting for the day one wraps it.
          event.preventDefault();
          commit();
        }}
      />
    </div>
  );
}
