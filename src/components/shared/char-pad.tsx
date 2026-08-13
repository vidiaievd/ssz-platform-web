'use client';

/**
 * A row of characters the keyboard in front of the learner may not have.
 *
 * Norwegian is written with æ ø å, and a learner on a phone bought abroad — or on a
 * laptop with a US layout — cannot type them without going hunting in system settings.
 * A learner who cannot type "å" cannot correct "far" into "får", and the exercise
 * silently becomes impossible rather than hard.
 *
 * It writes into whatever text field has focus, at the caret, rather than being wired
 * to one field: an exercise has many fields, they come and go as words are opened, and
 * a pad per field would be a pad per word. Two things make that work — the buttons
 * refuse the mouse-down that would take focus away, and the value is set through the
 * DOM property setter so that a React-controlled field sees a real `input` event and
 * updates its own state.
 */
export interface CharPadProps {
  /** The characters to offer, in the order they should read. */
  chars: readonly string[];
  /** Off while no field can receive the character. */
  disabled?: boolean;
  /** Announced on the group, for screen readers that read the buttons out of context. */
  label: string;
  /** Fired after a character was written, with the character. */
  onInsert?: (char: string) => void;
}

const NATIVE_SETTER = (element: HTMLElement): ((value: string) => void) | null => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;
  if (prototype === null) return null;

  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  return setter === undefined ? null : (value: string) => setter.call(element, value);
};

/** Writes `char` into the focused field at the caret. No focused field: nothing happens. */
export function insertIntoFocusedField(char: string): boolean {
  const element = document.activeElement;
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    return false;
  }

  const setValue = NATIVE_SETTER(element);
  if (setValue === null) return false;

  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? start;
  setValue(element.value.slice(0, start) + char + element.value.slice(end));
  element.setSelectionRange(start + char.length, start + char.length);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

export function CharPad({ chars, disabled = false, label, onInsert }: CharPadProps) {
  return (
    <span role="group" aria-label={label} className="inline-flex items-center gap-1">
      {chars.map((char) => (
        <button
          key={char}
          type="button"
          disabled={disabled}
          // Without this the field loses focus before the click lands, and there is
          // nothing left to write into.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (insertIntoFocusedField(char)) onInsert?.(char);
          }}
          className="rounded-md border px-2 py-1 text-[13px] leading-none disabled:opacity-40"
          style={{
            minHeight: 30,
            minWidth: 30,
            borderColor: 'var(--ssz-border-default)',
            background: 'var(--ssz-bg-surface)',
            color: 'var(--ssz-text-primary)',
          }}
        >
          {char}
        </button>
      ))}
    </span>
  );
}
