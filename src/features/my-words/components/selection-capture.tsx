'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { readWordSelection, type WordSelection } from '../lib/read-word-selection';
import { useWordCapture } from './word-capture-provider';

/**
 * Lets the reader select a word of the text — by dragging or a double-click — and add it
 * to «My words» from a button that appears over it (plan 75). Only one word, only inside
 * a paragraph marked capturable: the translation column and the rail are left alone.
 */
export function SelectionCapture({ children }: { children: ReactNode }) {
  const t = useTranslations('Learning.myWords');
  const capture = useWordCapture();
  const rootRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<WordSelection | null>(null);

  useEffect(() => {
    if (!capture) return;
    let frame = 0;
    function read() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        setCurrent(root ? readWordSelection(document.getSelection(), root) : null);
      });
    }
    // The box moves with the text; dropping the button is simpler than chasing it.
    function hide() {
      setCurrent(null);
    }
    document.addEventListener('selectionchange', read);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', read);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [capture]);

  return (
    <div ref={rootRef}>
      {children}
      {capture &&
        current &&
        createPortal(
          <button
            type="button"
            // Keeps the selection alive: a mousedown elsewhere would collapse it first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              capture.open({
                surfaceForm: current.surfaceForm,
                contextSentence: current.contextSentence || null,
                paragraphIndex: current.paragraphIndex,
              });
              document.getSelection()?.removeAllRanges();
              setCurrent(null);
            }}
            className="fixed z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-(--ssz-color-primary-600) px-3 py-1.5 text-xs font-semibold text-white shadow-(--ssz-shadow-md) hover:bg-(--ssz-color-primary-700)"
            style={{
              top: Math.max(8, current.rect.top - 40),
              left: current.rect.left + current.rect.width / 2,
            }}
          >
            <BookmarkPlus className="size-3.5" aria-hidden="true" />
            {t('add')}
          </button>,
          document.body,
        )}
    </div>
  );
}
