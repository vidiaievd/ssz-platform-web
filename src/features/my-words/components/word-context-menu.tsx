'use client';

import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { wordAtPoint, type CapturedWord } from '../lib/word-at-point';
import { useWordCapture } from './word-capture-provider';

/**
 * A right click — or a long press on a touch screen — on a word of the text opens a menu
 * to add that word to «My words» (plan 75). The word is found whole under the pointer,
 * whatever part of it was hit, and highlighted while the menu is open.
 *
 * Anywhere else, and over a selection the reader made, the browser keeps its own menu:
 * copying text must still work.
 */
export function WordContextMenu({ lang, children }: { lang?: string; children: ReactNode }) {
  const t = useTranslations('Learning.myWords');
  const capture = useWordCapture();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; word: CapturedWord } | null>(null);

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (!capture || !rootRef.current) return;
    const selection = document.getSelection();
    if (selection && !selection.isCollapsed) return;
    const word = wordAtPoint(event.clientX, event.clientY, rootRef.current);
    if (!word) return;

    event.preventDefault();
    selection?.removeAllRanges();
    selection?.addRange(word.range);
    setMenu({ x: event.clientX, y: event.clientY, word });
  }

  function close() {
    document.getSelection()?.removeAllRanges();
    setMenu(null);
  }

  return (
    <div ref={rootRef} onContextMenu={handleContextMenu}>
      {children}
      {capture && menu && (
        <DropdownMenu open modal={false} onOpenChange={(open) => !open && close()}>
          <DropdownMenuTrigger asChild>
            {/* A zero-size anchor where the pointer was: the menu opens at the click. */}
            <span
              aria-hidden="true"
              className="pointer-events-none fixed size-0"
              style={{ left: menu.x, top: menu.y }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="min-w-52">
            <DropdownMenuLabel lang={lang} className="font-reading text-base">
              {menu.word.surfaceForm}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => {
                capture.open({
                  surfaceForm: menu.word.surfaceForm,
                  contextSentence: menu.word.contextSentence || null,
                  paragraphIndex: menu.word.paragraphIndex,
                });
                close();
              }}
            >
              <BookmarkPlus className="size-4" aria-hidden="true" />
              {t('addToMyWords')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
