'use client';

import { useEffect } from 'react';

export interface ReviewShortcuts {
  /** `1` — pass. Omit it and the key does nothing, which is how a disabled verdict says so. */
  approve?: () => void;
  /** `2` — pass with what has been written. */
  approveWithComment?: () => void;
  /** `3` — send back. Never bound while there is no comment (criterion 18). */
  return?: () => void;
  /** `J` and `K` — along the queue. Bound even when there is no verdict left to give. */
  next?: () => void;
  previous?: () => void;
  /**
   * `Cmd/Ctrl+Enter` — send from wherever the cursor is, including the comment field.
   * The one shortcut that is deliberately not blocked by a text box: it is the gesture
   * for "done writing, send it", and it exists because the plain keys cannot be.
   */
  submit?: () => void;
  enabled?: boolean;
}

/**
 * The review screen from the keyboard.
 *
 * Marking is repetitive work, and the mouse is the slow part of it: read, decide, move
 * on, forty times. Digits for the three verdicts and `J`/`K` for the queue turn that into
 * something a teacher can do without looking away from the text.
 *
 * The rule that makes it safe is that none of the letters fire while the cursor is in a
 * text field (criterion 17). A teacher writing "3 setninger er feil" would otherwise send
 * the work back on the first character — a destructive action, taken silently, from an
 * ordinary sentence. `Cmd/Ctrl+Enter` is the single exception, because a chord is not
 * something a comment can contain.
 *
 * Bindings are the caller's to leave out. A verdict that is refused on screen — a return
 * with nothing written, a submission a colleague has already answered — is not passed in
 * at all, so the key is inert rather than firing something the button forbids.
 */
export function useReviewShortcuts({ enabled = true, ...handlers }: ReviewShortcuts): void {
  // Read through a ref-free closure on purpose: the handlers change on almost every
  // keystroke (the comment is in them), and re-binding one window listener is cheaper
  // than the machinery to avoid it.
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      // Something nearer the user already dealt with it — a dialog, a menu, a form.
      if (event.defaultPrevented || event.repeat) return;

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        if (handlers.submit === undefined) return;
        event.preventDefault();
        handlers.submit();
        return;
      }

      // A modified key is somebody else's shortcut — the browser's, the OS's.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const action = bindingFor(event.key, handlers);
      if (action === undefined) return;

      event.preventDefault();
      action();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handlers]);
}

function bindingFor(key: string, handlers: ReviewShortcuts): (() => void) | undefined {
  switch (key.toLowerCase()) {
    case '1':
      return handlers.approve;
    case '2':
      return handlers.approveWithComment;
    case '3':
      return handlers.return;
    case 'j':
      return handlers.next;
    case 'k':
      return handlers.previous;
    default:
      return undefined;
  }
}

/** Where a keystroke means a letter rather than a command. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
